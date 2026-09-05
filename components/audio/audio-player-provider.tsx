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
	type MediaItem,
} from "@/lib/media-api";
import { shouldUseHlsJs } from "@/lib/browser-device-profile";
import type { AuthSession } from "@/lib/session";

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
	isLoading: boolean;
	error: string | null;
	autoplayBlocked: boolean;
	queueOpen: boolean;
};

type AudioPlayerContextValue = AudioPlayerState & {
	playAlbum: (
		album: MediaItem,
		tracks: MediaItem[],
		selectedTrackId?: string,
		shuffle?: boolean,
	) => void;
	playTrack: (track: MediaItem, albumTracks?: MediaItem[]) => Promise<void>;
	addAlbumToQueue: (album: MediaItem, tracks: MediaItem[]) => void;
	togglePlay: () => void;
	resume: () => void;
	playNext: () => void;
	playPrevious: () => void;
	playQueueItem: (index: number) => void;
	seek: (positionSeconds: number) => void;
	setVolume: (volume: number) => void;
	toggleShuffle: () => void;
	removeQueueItem: (entryId: string) => void;
	reorderQueue: (fromIndex: number, toIndex: number) => void;
	setQueueOpen: (open: boolean) => void;
	clearAudioPlayer: () => void;
};

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
	const [shuffle, setShuffle] = useState(false);
	const [volume, setVolumeState] = useState(1);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [autoplayBlocked, setAutoplayBlocked] = useState(false);
	const [queueOpen, setQueueOpen] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const hlsRef = useRef<Hls | null>(null);
	const loadGeneration = useRef(0);
	const shouldPlayRef = useRef(false);
	const queueRef = useRef(queue);
	const currentIndexRef = useRef(currentIndex);
	const volumeRef = useRef(volume);
	const progressReportedAt = useRef(0);
	const playStartPromises = useRef(new Map<string, Promise<void>>());
	const playStartCompleted = useRef(new Set<string>());

	useEffect(() => {
		queueRef.current = queue;
	}, [queue]);
	useEffect(() => {
		currentIndexRef.current = currentIndex;
	}, [currentIndex]);
	useEffect(() => {
		volumeRef.current = volume;
		if (audioRef.current) audioRef.current.volume = volume;
	}, [volume]);

	const currentEntry = queue[currentIndex] ?? null;
	const currentTrack = currentEntry?.track ?? null;

	const sendPlayStart = useCallback(
		(entry: AudioQueueEntry) => {
			if (!watchHistoryEnabled || playStartCompleted.current.has(entry.id)) return;
			const pending = playStartPromises.current.get(entry.id);
			if (pending) return;
			const request = recordAudioPlayStart(
				session,
				entry.track.Id,
				entry.playbackInstanceId,
			)
				.then(() => {
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
			const nextIndex = currentIndexRef.current + 1;
			if (nextIndex < queueRef.current.length) {
				setCurrentIndex(nextIndex);
				shouldPlayRef.current = true;
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
	}, [currentEntry, reportPosition, sendPlayStart]);

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
				if (!active || generation !== loadGeneration.current || !audioRef.current) return;
				const url = playbackUrl(playback.source);
				audio.volume = volumeRef.current;
				audio.preload = "metadata";
				if (/\.m3u8(?:\?|$)/i.test(url) && shouldUseHlsJs() && Hls.isSupported()) {
					const hls = new Hls({ enableWorker: true });
					hlsRef.current = hls;
					hls.on(Hls.Events.MANIFEST_PARSED, () => {
						if (active && generation === loadGeneration.current && shouldPlayRef.current)
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
					loadError instanceof Error ? loadError.message : "Audio could not be loaded.",
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
			const ordered = useShuffle ? shuffled(uniqueTracks(tracks)) : uniqueTracks(tracks);
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
						loadError instanceof Error ? loadError.message : "Album could not be loaded.",
					);
				}
			}
			const available = tracks?.length ? tracks : [track];
			playAlbum(
				track,
				available,
				track.Id,
				false,
			);
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

	const setVolume = useCallback((nextVolume: number) => {
		const safeVolume = Math.max(0, Math.min(1, nextVolume));
		setVolumeState(safeVolume);
	}, []);

	const toggleShuffle = useCallback(() => {
		setShuffle((current) => !current);
	}, []);

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

	const clearAudioPlayer = useCallback(() => {
		shouldPlayRef.current = false;
		setQueue([]);
		setCurrentIndex(-1);
		setIsPlaying(false);
		setPositionSeconds(0);
		setDurationSeconds(0);
		setIsLoading(false);
		setError(null);
		setAutoplayBlocked(false);
		setQueueOpen(false);
		playStartPromises.current.clear();
		playStartCompleted.current.clear();
	}, []);

	const value = useMemo<AudioPlayerContextValue>(
		() => ({
			queue,
			currentIndex,
			currentTrack,
			positionSeconds,
			durationSeconds,
			isPlaying,
			shuffle,
			volume,
			isLoading,
			error,
			autoplayBlocked,
			queueOpen,
			playAlbum,
			playTrack,
			addAlbumToQueue,
			togglePlay,
			resume,
			playNext,
			playPrevious,
			playQueueItem,
			seek,
			setVolume,
			toggleShuffle,
			removeQueueItem,
			reorderQueue,
			setQueueOpen,
			clearAudioPlayer,
		}),
		[
			addAlbumToQueue,
			autoplayBlocked,
			clearAudioPlayer,
			currentIndex,
			currentTrack,
			durationSeconds,
			error,
			isLoading,
			isPlaying,
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
			setVolume,
			shuffle,
			togglePlay,
			toggleShuffle,
			volume,
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
	if (!value) throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
	return value;
}
