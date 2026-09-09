"use client";

import Hls from "hls.js";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import {
	fetchAudioAlbumData,
	getPlaybackInfo,
	playbackUrl,
	recordAudioPlayStart,
	reportPlayback,
	savedPlaybackPositionSeconds,
	setFavorite,
	type MediaItem,
} from "@/lib/media-api";
import { shouldUseHlsJs } from "@/lib/browser-device-profile";
import type { AuthSession } from "@/lib/session";
import {
	readStoredAudioPlayerPreferences,
	writeStoredAudioPlayerPreferences,
	type AudioLoopMode,
	type AudioPlayerPreferences,
} from "@/lib/player-preferences";

export type { AudioLoopMode } from "@/lib/player-preferences";

export type AudioQueueEntry = {
	id: string;
	track: MediaItem;
	playbackInstanceId: string;
};

export type AudioPlayerState = {
	queue: AudioQueueEntry[];
	currentIndex: number;
	currentTrack: MediaItem | null;
	positionSeconds: number;
	durationSeconds: number;
	isPlaying: boolean;
	shuffle: boolean;
	volume: number;
	muted: boolean;
	loopMode: AudioLoopMode;
	isLoading: boolean;
	error: string | null;
	autoplayBlocked: boolean;
	queueOpen: boolean;
	lyricsOpen: boolean;
};

type AudioPlayerContextValue = AudioPlayerState & {
	session: AuthSession;
	playAlbum: (
		album: MediaItem,
		tracks: MediaItem[],
		selectedTrackId?: string,
		shuffle?: boolean,
	) => void;
	playTrack: (track: MediaItem, albumTracks?: MediaItem[]) => Promise<void>;
	addAlbumToQueue: (album: MediaItem, tracks: MediaItem[]) => void;
	togglePlay: () => void;
	stop: () => void;
	resume: () => void;
	playNext: () => void;
	playPrevious: () => void;
	playQueueItem: (index: number) => void;
	seek: (positionSeconds: number) => void;
	setVolume: (volume: number) => void;
	toggleMuted: () => void;
	toggleShuffle: () => void;
	cycleLoopMode: () => void;
	removeQueueItem: (entryId: string) => void;
	reorderQueue: (fromIndex: number, toIndex: number) => void;
	setQueueOpen: (open: boolean) => void;
	toggleLyrics: () => void;
	setLyricsOpen: (open: boolean) => void;
	toggleFavorite: () => Promise<void>;
	clearAudioPlayer: () => void;
};

type AudioPreferencesUpdate =
	| Partial<AudioPlayerPreferences>
	| ((current: AudioPlayerPreferences) => Partial<AudioPlayerPreferences>);

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

function newPlaybackInstanceId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
		return crypto.randomUUID();
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function shuffled<T>(values: T[]) {
	const result = [...values];
	for (let index = result.length - 1; index > 0; index -= 1) {
		const target = Math.floor(Math.random() * (index + 1));
		[result[index], result[target]] = [result[target], result[index]];
	}
	return result;
}

function uniqueTracks(tracks: MediaItem[]) {
	const seen = new Set<string>();
	return tracks.filter((track) => {
		if (!track.Id || seen.has(track.Id)) return false;
		seen.add(track.Id);
		return track.Type === "Audio";
	});
}

export function AudioPlayerProvider({
	session,
	watchHistoryEnabled = true,
	children,
}: {
	session: AuthSession;
	watchHistoryEnabled?: boolean;
	children: ReactNode;
}) {
	const [queue, setQueue] = useState<AudioQueueEntry[]>([]);
	const [currentIndex, setCurrentIndex] = useState(-1);
	const [positionSeconds, setPositionSeconds] = useState(0);
	const [durationSeconds, setDurationSeconds] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [preferences, setPreferences] = useState<AudioPlayerPreferences>(() =>
		readStoredAudioPlayerPreferences(),
	);
	const { shuffle, volume, muted, loopMode } = preferences;
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [autoplayBlocked, setAutoplayBlocked] = useState(false);
	const [queueOpen, setQueueOpen] = useState(false);
	const [lyricsOpen, setLyricsOpen] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const hlsRef = useRef<Hls | null>(null);
	const loadGeneration = useRef(0);
	const shouldPlayRef = useRef(false);
	const queueRef = useRef(queue);
	const currentIndexRef = useRef(currentIndex);
	const volumeRef = useRef(volume);
	const mutedRef = useRef(muted);
	const loopModeRef = useRef(loopMode);
	const progressReportedAt = useRef(0);
	const playStartPromises = useRef(new Map<string, Promise<void>>());
	const playStartCompleted = useRef(new Set<string>());
	const playStartGeneration = useRef(0);

	const updatePreferences = useCallback((update: AudioPreferencesUpdate) => {
		setPreferences((current) => {
			const changes = typeof update === "function" ? update(current) : update;
			const next = { ...current, ...changes };
			writeStoredAudioPlayerPreferences(next);
			return next;
		});
	}, []);

	useEffect(() => {
		queueRef.current = queue;
	}, [queue]);
	useEffect(() => {
		currentIndexRef.current = currentIndex;
	}, [currentIndex]);
	useEffect(() => {
		volumeRef.current = volume;
		mutedRef.current = muted;
		if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
	}, [muted, volume]);
	useEffect(() => {
		loopModeRef.current = loopMode;
	}, [loopMode]);

	const currentEntry = queue[currentIndex] ?? null;
	const currentTrack = currentEntry?.track ?? null;

	const sendPlayStart = useCallback(
		(entry: AudioQueueEntry) => {
			if (!watchHistoryEnabled || playStartCompleted.current.has(entry.id)) return;
			const pending = playStartPromises.current.get(entry.id);
			if (pending) return;
			const generation = playStartGeneration.current;
			const request = recordAudioPlayStart(
				session,
				entry.track.Id,
				entry.playbackInstanceId,
			)
				.then(() => {
					if (generation === playStartGeneration.current)
						playStartCompleted.current.add(entry.id);
				})
				.catch((requestError) => {
					playStartPromises.current.delete(entry.id);
					throw requestError;
				}) as Promise<void>;
			playStartPromises.current.set(entry.id, request);
			void request.catch((requestError) => {
				if (currentEntry?.id === entry.id)
					setError(
						requestError instanceof Error
							? requestError.message
							: "Could not record audio playback.",
					);
			});
		},
		[currentEntry?.id, session, watchHistoryEnabled],
	);

	const reportPosition = useCallback(
		(force = false) => {
			const entry = queueRef.current[currentIndexRef.current];
			const audio = audioRef.current;
			if (!entry || !audio || !watchHistoryEnabled) return;
			const now = Date.now();
			if (!force && now - progressReportedAt.current < 10_000) return;
			progressReportedAt.current = now;
			void reportPlayback(
				session,
				entry.track.Id,
				audio.currentTime,
				audio.paused,
				audio.duration,
			).catch(() => undefined);
		},
		[session, watchHistoryEnabled],
	);

	const attemptPlay = useCallback(
		(entry: AudioQueueEntry) => {
			const audio = audioRef.current;
			if (!audio) return;
			void audio
				.play()
				.then(() => {
					setIsPlaying(true);
					setAutoplayBlocked(false);
					setError(null);
					sendPlayStart(entry);
				})
				.catch((playError) => {
					setIsPlaying(false);
					setAutoplayBlocked(true);
					setError(
						playError instanceof Error
							? playError.message
							: "Playback needs a user gesture.",
					);
				});
		},
		[sendPlayStart],
	);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		const onTimeUpdate = () => {
			setPositionSeconds(audio.currentTime || 0);
			reportPosition();
		};
		const onLoadedMetadata = () => {
			const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
			setDurationSeconds(duration || currentEntry?.track.DurationSeconds || 0);
		};
		const onPlay = () => {
			setIsPlaying(true);
			if (currentEntry) sendPlayStart(currentEntry);
		};
		const onPause = () => {
			setIsPlaying(false);
			reportPosition(true);
		};
		const onEnded = () => {
			reportPosition(true);
			const currentEntryAtEnd = queueRef.current[currentIndexRef.current];
			if (!currentEntryAtEnd) {
				shouldPlayRef.current = false;
				setIsPlaying(false);
				return;
			}
			if (loopModeRef.current === "single") {
				shouldPlayRef.current = true;
				audio.currentTime = 0;
				setPositionSeconds(0);
				attemptPlay(currentEntryAtEnd);
				return;
			}
			const nextIndex = currentIndexRef.current + 1;
			if (nextIndex < queueRef.current.length) {
				setCurrentIndex(nextIndex);
				shouldPlayRef.current = true;
			} else if (loopModeRef.current === "queue") {
				shouldPlayRef.current = true;
				if (queueRef.current.length === 1) {
					audio.currentTime = 0;
					setPositionSeconds(0);
					attemptPlay(currentEntryAtEnd);
				} else {
					setCurrentIndex(0);
				}
			} else {
				shouldPlayRef.current = false;
				setIsPlaying(false);
			}
		};
		const onError = () => {
			setIsPlaying(false);
			setError("Audio could not be played.");
		};
		audio.addEventListener("timeupdate", onTimeUpdate);
		audio.addEventListener("loadedmetadata", onLoadedMetadata);
		audio.addEventListener("play", onPlay);
		audio.addEventListener("pause", onPause);
		audio.addEventListener("ended", onEnded);
		audio.addEventListener("error", onError);
		return () => {
			audio.removeEventListener("timeupdate", onTimeUpdate);
			audio.removeEventListener("loadedmetadata", onLoadedMetadata);
			audio.removeEventListener("play", onPlay);
			audio.removeEventListener("pause", onPause);
			audio.removeEventListener("ended", onEnded);
			audio.removeEventListener("error", onError);
		};
	}, [attemptPlay, currentEntry, reportPosition, sendPlayStart]);

	useEffect(() => {
		const audio = audioRef.current;
		const entry = currentEntry;
		const generation = ++loadGeneration.current;
		let active = true;
		hlsRef.current?.destroy();
		hlsRef.current = null;
		if (!audio || !entry) {
			if (audio) {
				audio.pause();
				audio.removeAttribute("src");
				audio.load();
			}
			setIsLoading(false);
			setIsPlaying(false);
			setPositionSeconds(0);
			setDurationSeconds(0);
			return;
		}
		setIsLoading(true);
		setIsPlaying(false);
		setPositionSeconds(0);
		setDurationSeconds(entry.track.DurationSeconds ?? 0);
		setError(null);
		setAutoplayBlocked(false);
		const startPosition = savedPlaybackPositionSeconds(entry.track);
		void getPlaybackInfo(session, entry.track.Id, {
			startPositionSeconds: startPosition,
		})
			.then((playback) => {
				if (!active || generation !== loadGeneration.current || !audioRef.current)
					return;
				const url = playbackUrl(playback.source);
				audio.volume = mutedRef.current ? 0 : volumeRef.current;
				audio.preload = "metadata";
				if (/\.m3u8(?:\?|$)/i.test(url) && shouldUseHlsJs() && Hls.isSupported()) {
					const hls = new Hls({ enableWorker: true });
					hlsRef.current = hls;
					hls.on(Hls.Events.MANIFEST_PARSED, () => {
						if (
							active &&
							generation === loadGeneration.current &&
							shouldPlayRef.current
						)
							attemptPlay(entry);
					});
					hls.on(Hls.Events.ERROR, (_event, data) => {
						if (active && data.fatal && generation === loadGeneration.current)
							setError("Audio stream could not be loaded.");
					});
					hls.loadSource(url);
					hls.attachMedia(audio);
				} else {
					audio.src = url;
					audio.load();
				}
				setIsLoading(false);
				if (shouldPlayRef.current && !/\.m3u8(?:\?|$)/i.test(url))
					attemptPlay(entry);
			})
			.catch((loadError) => {
				if (!active || generation !== loadGeneration.current) return;
				setIsLoading(false);
				setError(
					loadError instanceof Error
						? loadError.message
						: "Audio could not be loaded.",
				);
			});
		return () => {
			active = false;
			audio.pause();
			audio.removeAttribute("src");
			audio.load();
		};
	}, [attemptPlay, currentEntry, session]);

	const makeEntries = useCallback((tracks: MediaItem[]) => {
		return uniqueTracks(tracks).map((track) => {
			const playbackInstanceId = newPlaybackInstanceId();
			return {
				id: `${track.Id}:${playbackInstanceId}`,
				track,
				playbackInstanceId,
			};
		});
	}, []);

	const playAlbum = useCallback(
		(
			album: MediaItem,
			tracks: MediaItem[],
			selectedTrackId?: string,
			useShuffle = shuffle,
		) => {
			void album;
			const ordered = useShuffle
				? shuffled(uniqueTracks(tracks))
				: uniqueTracks(tracks);
			if (!ordered.length) return;
			const entries = makeEntries(ordered);
			const requestedIndex = selectedTrackId
				? entries.findIndex((entry) => entry.track.Id === selectedTrackId)
				: 0;
			const index = requestedIndex >= 0 ? requestedIndex : 0;
			shouldPlayRef.current = true;
			setQueue(entries);
			setCurrentIndex(index);
			setQueueOpen(false);
			setError(null);
		},
		[makeEntries, shuffle],
	);

	const playTrack = useCallback(
		async (track: MediaItem, albumTracks?: MediaItem[]) => {
			let tracks = albumTracks;
			if (!tracks?.length && track.AlbumId) {
				try {
					const album = await fetchAudioAlbumData(session, track.AlbumId);
					tracks = album.tracks;
				} catch (loadError) {
					setError(
						loadError instanceof Error
							? loadError.message
							: "Album could not be loaded.",
					);
				}
			}
			const available = tracks?.length ? tracks : [track];
			playAlbum(track, available, track.Id, false);
		},
		[playAlbum, session],
	);

	const addAlbumToQueue = useCallback(
		(album: MediaItem, tracks: MediaItem[]) => {
			void album;
			const entries = makeEntries(tracks);
			if (!entries.length) return;
			setQueue((current) => (current.length ? [...current, ...entries] : entries));
			if (currentIndexRef.current < 0) setCurrentIndex(0);
		},
		[makeEntries],
	);

	const togglePlay = useCallback(() => {
		const audio = audioRef.current;
		const entry = queueRef.current[currentIndexRef.current];
		if (!audio || !entry) return;
		if (audio.paused) {
			shouldPlayRef.current = true;
			attemptPlay(entry);
		} else {
			shouldPlayRef.current = false;
			audio.pause();
		}
	}, [attemptPlay]);

	const resume = useCallback(() => {
		const entry = queueRef.current[currentIndexRef.current];
		if (!entry) return;
		shouldPlayRef.current = true;
		setAutoplayBlocked(false);
		attemptPlay(entry);
	}, [attemptPlay]);

	const playNext = useCallback(() => {
		const nextIndex = currentIndexRef.current + 1;
		if (nextIndex >= queueRef.current.length) return;
		shouldPlayRef.current = true;
		setCurrentIndex(nextIndex);
	}, []);

	const playPrevious = useCallback(() => {
		const audio = audioRef.current;
		if (audio && audio.currentTime > 3) {
			audio.currentTime = 0;
			setPositionSeconds(0);
			return;
		}
		const previousIndex = currentIndexRef.current - 1;
		if (previousIndex < 0) return;
		shouldPlayRef.current = true;
		setCurrentIndex(previousIndex);
	}, []);

	const playQueueItem = useCallback((index: number) => {
		if (index < 0 || index >= queueRef.current.length) return;
		shouldPlayRef.current = true;
		setCurrentIndex(index);
	}, []);

	const seek = useCallback((nextPosition: number) => {
		const audio = audioRef.current;
		if (!audio || !Number.isFinite(nextPosition)) return;
		audio.currentTime = Math.max(0, nextPosition);
		setPositionSeconds(audio.currentTime);
	}, []);

	const setVolume = useCallback(
		(nextVolume: number) => {
			updatePreferences((current) => ({
				volume: Number.isFinite(nextVolume)
					? Math.max(0, Math.min(1, nextVolume))
					: current.volume,
				muted: false,
			}));
		},
		[updatePreferences],
	);

	const toggleMuted = useCallback(() => {
		updatePreferences((current) => ({ muted: !current.muted }));
	}, [updatePreferences]);

	const toggleShuffle = useCallback(() => {
		updatePreferences((current) => ({ shuffle: !current.shuffle }));
	}, [updatePreferences]);

	const cycleLoopMode = useCallback(() => {
		updatePreferences((current) => ({
			loopMode:
				current.loopMode === "off"
					? "queue"
					: current.loopMode === "queue"
						? "single"
						: "off",
		}));
	}, [updatePreferences]);

	const removeQueueItem = useCallback((entryId: string) => {
		setQueue((current) => {
			const removedIndex = current.findIndex((entry) => entry.id === entryId);
			if (removedIndex < 0) return current;
			const next = current.filter((entry) => entry.id !== entryId);
			if (removedIndex === currentIndexRef.current) {
				const nextIndex = Math.min(removedIndex, next.length - 1);
				setCurrentIndex(nextIndex);
				shouldPlayRef.current = nextIndex >= 0;
			} else if (removedIndex < currentIndexRef.current) {
				setCurrentIndex((index) => index - 1);
			}
			return next;
		});
	}, []);

	const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
		setQueue((current) => {
			if (
				fromIndex < 0 ||
				toIndex < 0 ||
				fromIndex >= current.length ||
				toIndex >= current.length ||
				fromIndex === toIndex
			)
				return current;
			const next = [...current];
			const [entry] = next.splice(fromIndex, 1);
			next.splice(toIndex, 0, entry);
			setCurrentIndex((index) => {
				if (index === fromIndex) return toIndex;
				if (fromIndex < index && index <= toIndex) return index - 1;
				if (toIndex <= index && index < fromIndex) return index + 1;
				return index;
			});
			return next;
		});
	}, []);

	const toggleFavorite = useCallback(async () => {
		const entry = queueRef.current[currentIndexRef.current];
		if (!entry) return;
		const previous = Boolean(entry.track.UserData?.IsFavorite);
		const next = !previous;
		const updateCurrentTrack = (favorite: boolean) => {
			setQueue((current) =>
				current.map((candidate) =>
					candidate.id === entry.id
						? {
								...candidate,
								track: {
									...candidate.track,
									UserData: {
										...candidate.track.UserData,
										IsFavorite: favorite,
									},
								},
							}
						: candidate,
				),
			);
		};

		updateCurrentTrack(next);
		try {
			await setFavorite(session, entry.track.Id, next);
		} catch (favoriteError) {
			updateCurrentTrack(previous);
			setError(
				favoriteError instanceof Error
					? favoriteError.message
					: "Could not update the favorite.",
			);
		}
	}, [session]);

	const clearAudioPlayer = useCallback(() => {
		shouldPlayRef.current = false;
		loadGeneration.current += 1;
		hlsRef.current?.destroy();
		hlsRef.current = null;
		const audio = audioRef.current;
		if (audio) {
			audio.pause();
			audio.removeAttribute("src");
			audio.load();
		}
		setQueue([]);
		setCurrentIndex(-1);
		setIsPlaying(false);
		setPositionSeconds(0);
		setDurationSeconds(0);
		setIsLoading(false);
		setError(null);
		setAutoplayBlocked(false);
		setQueueOpen(false);
		setLyricsOpen(false);
		playStartGeneration.current += 1;
		playStartPromises.current.clear();
		playStartCompleted.current.clear();
	}, []);

	const toggleLyrics = useCallback(() => {
		setLyricsOpen((current) => !current);
	}, []);

	const stop = useCallback(() => {
		clearAudioPlayer();
	}, [clearAudioPlayer]);

	const value = useMemo<AudioPlayerContextValue>(
		() => ({
			session,
			queue,
			currentIndex,
			currentTrack,
			positionSeconds,
			durationSeconds,
			isPlaying,
			shuffle,
			volume,
			muted,
			loopMode,
			isLoading,
			error,
			autoplayBlocked,
			queueOpen,
			lyricsOpen,
			playAlbum,
			playTrack,
			addAlbumToQueue,
			togglePlay,
			stop,
			resume,
			playNext,
			playPrevious,
			playQueueItem,
			seek,
			setVolume,
			toggleMuted,
			toggleShuffle,
			cycleLoopMode,
			removeQueueItem,
			reorderQueue,
			setQueueOpen,
			toggleLyrics,
			setLyricsOpen,
			toggleFavorite,
			clearAudioPlayer,
		}),
		[
			addAlbumToQueue,
			autoplayBlocked,
			clearAudioPlayer,
			currentIndex,
			currentTrack,
			cycleLoopMode,
			durationSeconds,
			error,
			isLoading,
			isPlaying,
			lyricsOpen,
			loopMode,
			playAlbum,
			playNext,
			playQueueItem,
			playPrevious,
			playTrack,
			positionSeconds,
			queue,
			queueOpen,
			removeQueueItem,
			reorderQueue,
			resume,
			seek,
			session,
			setVolume,
			setLyricsOpen,
			stop,
			toggleMuted,
			shuffle,
			togglePlay,
			toggleShuffle,
			toggleFavorite,
			toggleLyrics,
			volume,
			muted,
		],
	);

	return (
		<AudioPlayerContext.Provider value={value}>
			<audio ref={audioRef} preload="metadata" aria-hidden="true" />
			{children}
		</AudioPlayerContext.Provider>
	);
}

export function useAudioPlayer() {
	const value = useContext(AudioPlayerContext);
	if (!value)
		throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
	return value;
}
