"use client";

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type PointerEvent as ReactPointerEvent,
} from "react";
import {
	ImagePlus,
	LoaderCircle,
	RotateCcw,
	RotateCw,
	Trash2,
	Upload,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { UserAvatar } from "@/components/account/user-avatar";
import { useI18n } from "@/lib/i18n";
import {
	AVATAR_ACCEPT,
	AVATAR_MAX_BYTES,
	removeAvatar,
	uploadAvatar,
	type AvatarCropParams,
} from "@/lib/profile";
import type { AuthSession } from "@/lib/session";

type AvatarEditModalProps = {
	session: AuthSession;
	displayName: string;
	userId: string;
	avatarVersion?: string | null;
	onClose: () => void;
	onSaved: (avatarVersion: string | null) => void;
};

type Point = { x: number; y: number };
type Dimensions = { w: number; h: number };

const ACCEPTED_MIME_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
]);

function hasAcceptedExtension(name: string) {
	return /\.(?:jpe?g|png|webp|gif)$/i.test(name);
}

function formatFileSize(bytes: number) {
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AvatarEditModal({
	session,
	displayName,
	userId,
	avatarVersion,
	onClose,
	onSaved,
}: AvatarEditModalProps) {
	const { t } = useI18n();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const objectUrlRef = useRef<string | null>(null);
	const viewportRef = useRef<HTMLDivElement>(null);
	const lastPointerRef = useRef<Point>({ x: 0, y: 0 });
	const [file, setFile] = useState<File | null>(null);
	const [imageSrc, setImageSrc] = useState<string | null>(null);
	const [imageDimensions, setImageDimensions] = useState<Dimensions>({
		w: 0,
		h: 0,
	});
	const [viewportDimensions, setViewportDimensions] = useState<Dimensions>({
		w: 0,
		h: 0,
	});
	const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(0);
	const [rotation, setRotation] = useState(0);
	const [pointerDown, setPointerDown] = useState(false);
	const [dragActive, setDragActive] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const isFlipped = rotation === 90 || rotation === 270;
	const effectiveWidth = isFlipped ? imageDimensions.h : imageDimensions.w;
	const effectiveHeight = isFlipped ? imageDimensions.w : imageDimensions.h;
	const cropSize = Math.min(viewportDimensions.w, viewportDimensions.h) * 0.6;
	const cropLeft = (viewportDimensions.w - cropSize) / 2;
	const cropTop = (viewportDimensions.h - cropSize) / 2;
	const scale = Math.exp(zoom);

	const getMinZoom = useCallback(() => {
		if (effectiveWidth <= 0 || effectiveHeight <= 0 || cropSize <= 0) return 0;
		return Math.log(
			Math.max(cropSize / effectiveWidth, cropSize / effectiveHeight),
		);
	}, [cropSize, effectiveHeight, effectiveWidth]);

	const getMaxZoom = useCallback(() => {
		if (effectiveWidth <= 0 || effectiveHeight <= 0 || cropSize <= 0) return 0.1;
		const constraining = Math.min(effectiveWidth, effectiveHeight);
		const maxZoom = Math.log(cropSize / (constraining * 0.05));
		return Number.isFinite(maxZoom) ? maxZoom : 0.1;
	}, [cropSize, effectiveHeight, effectiveWidth]);

	const clampOffset = useCallback(
		(value: Point, nextScale: number) => {
			if (cropSize <= 0) return value;
			const maxX = Math.max(0, (effectiveWidth * nextScale) / 2 - cropSize / 2);
			const maxY = Math.max(0, (effectiveHeight * nextScale) / 2 - cropSize / 2);
			return {
				x: Math.max(-maxX, Math.min(maxX, value.x)),
				y: Math.max(-maxY, Math.min(maxY, value.y)),
			};
		},
		[cropSize, effectiveHeight, effectiveWidth],
	);

	const clearSelectedFile = () => {
		if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
		objectUrlRef.current = null;
		setFile(null);
		setImageSrc(null);
		setImageDimensions({ w: 0, h: 0 });
		setOffset({ x: 0, y: 0 });
		setZoom(0);
		setRotation(0);
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	useEffect(() => {
		return () => {
			if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
		};
	}, []);

	useEffect(() => {
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !saving) onClose();
		};
		document.addEventListener("keydown", closeOnEscape);
		return () => document.removeEventListener("keydown", closeOnEscape);
	}, [onClose, saving]);

	useEffect(() => {
		const element = viewportRef.current;
		if (!element || !imageSrc) return;

		const measure = () => {
			const rect = element.getBoundingClientRect();
			if (rect.width > 0 && rect.height > 0)
				setViewportDimensions({ w: rect.width, h: rect.height });
		};
		measure();
		if (typeof ResizeObserver === "undefined") {
			window.addEventListener("resize", measure);
			return () => window.removeEventListener("resize", measure);
		}
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, [imageSrc]);

	useEffect(() => {
		if (!imageSrc || !imageDimensions.w || !viewportDimensions.w) return;
		setZoom(getMinZoom());
		setOffset({ x: 0, y: 0 });
	}, [
		getMinZoom,
		imageDimensions.h,
		imageDimensions.w,
		imageSrc,
		viewportDimensions.w,
	]);

	useEffect(() => {
		if (!viewportDimensions.w) return;
		const minZoom = getMinZoom();
		const maxZoom = getMaxZoom();
		setZoom((current) => {
			const next = Math.max(minZoom, Math.min(maxZoom, current));
			setOffset((currentOffset) => clampOffset(currentOffset, Math.exp(next)));
			return next;
		});
	}, [clampOffset, getMaxZoom, getMinZoom, rotation, viewportDimensions]);

	useEffect(() => {
		const element = viewportRef.current;
		if (!element || !imageSrc) return;
		const handleWheel = (event: WheelEvent) => {
			event.preventDefault();
			const delta = -event.deltaY * 0.00125;
			setZoom((current) => {
				const next = Math.max(
					getMinZoom(),
					Math.min(getMaxZoom(), current + delta),
				);
				setOffset((currentOffset) => clampOffset(currentOffset, Math.exp(next)));
				return next;
			});
		};
		element.addEventListener("wheel", handleWheel, { passive: false });
		return () => element.removeEventListener("wheel", handleWheel);
	}, [clampOffset, getMaxZoom, getMinZoom, imageSrc]);

	const selectFile = (nextFile: File | undefined) => {
		if (!nextFile) return;
		setError(null);
		if (nextFile.size > AVATAR_MAX_BYTES) {
			setError(t("avatarFileTooLarge"));
			return;
		}
		if (
			!ACCEPTED_MIME_TYPES.has(nextFile.type) &&
			!hasAcceptedExtension(nextFile.name)
		) {
			setError(t("avatarInvalidFile"));
			return;
		}
		if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
		const objectUrl = URL.createObjectURL(nextFile);
		objectUrlRef.current = objectUrl;
		setFile(nextFile);
		setImageSrc(objectUrl);
		setImageDimensions({ w: 0, h: 0 });
		setOffset({ x: 0, y: 0 });
		setZoom(0);
		setRotation(0);
	};

	const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (saving) return;
		setPointerDown(true);
		lastPointerRef.current = { x: event.clientX, y: event.clientY };
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (!pointerDown) return;
		const delta = {
			x: event.clientX - lastPointerRef.current.x,
			y: event.clientY - lastPointerRef.current.y,
		};
		lastPointerRef.current = { x: event.clientX, y: event.clientY };
		setOffset((current) =>
			clampOffset({ x: current.x + delta.x, y: current.y + delta.y }, scale),
		);
	};

	const updateZoom = (nextZoom: number) => {
		const clamped = Math.max(getMinZoom(), Math.min(getMaxZoom(), nextZoom));
		setZoom(clamped);
		setOffset((current) => clampOffset(current, Math.exp(clamped)));
	};

	const rotate = (direction: -1 | 1) => {
		setRotation((current) => (current + direction * 90 + 360) % 360);
		setOffset({ x: 0, y: 0 });
	};

	const saveCrop = async () => {
		if (!file || !imageSrc || !imageDimensions.w || !cropSize) return;
		const currentOffset = clampOffset(offset, scale);
		const centerX = effectiveWidth / 2 - currentOffset.x / scale;
		const centerY = effectiveHeight / 2 - currentOffset.y / scale;
		const half = cropSize / (2 * scale);
		const crop: AvatarCropParams = {
			cropX: centerX - half,
			cropY: centerY - half,
			cropSize: cropSize / scale,
			rotation,
		};
		setSaving(true);
		setError(null);
		try {
			const result = await uploadAvatar(session, file, crop);
			onSaved(result.avatarVersion);
		} catch (saveError) {
			setError(
				saveError instanceof Error ? saveError.message : t("avatarUploadFailed"),
			);
		} finally {
			setSaving(false);
		}
	};

	const handleRemove = async () => {
		if (!avatarVersion) return;
		setSaving(true);
		setError(null);
		try {
			const result = await removeAvatar(session);
			onSaved(result.avatarVersion);
		} catch (removeError) {
			setError(
				removeError instanceof Error
					? removeError.message
					: t("avatarRemoveFailed"),
			);
		} finally {
			setSaving(false);
		}
	};

	const close = () => {
		if (!saving) onClose();
	};

	const minZoom = getMinZoom();
	const maxZoom = getMaxZoom();
	const zoomPercent =
		maxZoom <= minZoom ? 100 : Math.round(100 * Math.exp(zoom - minZoom));
	const clampedOffset = clampOffset(offset, scale);
	const previewSize = 56;
	const previewScale = cropSize > 0 ? previewSize / cropSize : 1;

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6"
			onPointerDown={(event) => {
				if (event.target === event.currentTarget) close();
			}}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="avatar-edit-title"
				className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/35 shadow-2xl shadow-black/60 backdrop-blur-2xl sm:max-h-[calc(100dvh-3rem)]"
			>
				<header className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-6">
					<div className="min-w-0">
						<h2
							id="avatar-edit-title"
							className="text-base font-semibold text-white sm:text-lg"
						>
							{t("avatarEditTitle")}
						</h2>
						<p className="mt-1 text-xs leading-relaxed text-white/45">
							{t("avatarEditDescription")}
						</p>
					</div>
					<button
						type="button"
						onClick={close}
						disabled={saving}
						aria-label={t("close")}
						className="shrink-0 rounded-lg p-2 text-white/45 transition hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
					>
						<X className="h-5 w-5" />
					</button>
				</header>

				<input
					ref={fileInputRef}
					type="file"
					accept={AVATAR_ACCEPT}
					className="sr-only"
					onChange={(event) => selectFile(event.target.files?.[0])}
				/>

				{!imageSrc ? (
					<div className="space-y-5 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
						<button
							type="button"
							onClick={() => {
								if (fileInputRef.current) fileInputRef.current.value = "";
								fileInputRef.current?.click();
							}}
							className="group flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.025] px-6 py-12 text-center transition hover:border-violet-300/60 hover:bg-white/[0.05]"
							onDragOver={(event) => {
								event.preventDefault();
								setDragActive(true);
							}}
							onDragLeave={() => setDragActive(false)}
							onDrop={(event) => {
								event.preventDefault();
								setDragActive(false);
								selectFile(event.dataTransfer.files[0]);
							}}
							style={
								dragActive
									? {
											borderColor: "rgb(196 181 253 / 0.75)",
											backgroundColor: "rgb(196 181 253 / 0.08)",
										}
									: undefined
							}
						>
							<span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-300/10 text-violet-200 transition group-hover:bg-violet-300/15">
								<ImagePlus className="h-7 w-7" />
							</span>
							<span className="text-sm font-semibold text-white">
								{t("avatarChooseImage")}
							</span>
							<span className="mt-2 text-xs text-white/40">{t("avatarDropHint")}</span>
							<span className="mt-4 text-[11px] text-white/25">
								{t("avatarSupportedFormats", { size: "20 MB" })}
							</span>
						</button>

						{avatarVersion && (
							<div className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3">
								<div className="flex min-w-0 items-center gap-3">
									<UserAvatar
										displayName={displayName}
										userId={userId}
										avatarVersion={avatarVersion}
										containerClassName="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/8 ring-1 ring-white/12"
									/>
									<p className="truncate text-xs text-white/55">
										{t("avatarCurrentImage")}
									</p>
								</div>
								<button
									type="button"
									onClick={() => void handleRemove()}
									disabled={saving}
									className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-red-200/75 transition hover:bg-red-400/10 hover:text-red-200 disabled:opacity-40"
								>
									<Trash2 className="h-3.5 w-3.5" />
									{t("avatarRemove")}
								</button>
							</div>
						)}
					</div>
				) : (
					<>
						<div
							ref={viewportRef}
							className="relative min-h-[min(55vh,30rem)] flex-1 cursor-grab select-none touch-none overflow-hidden bg-black/35 active:cursor-grabbing"
							onPointerDown={handlePointerDown}
							onPointerUp={() => setPointerDown(false)}
							onPointerCancel={() => setPointerDown(false)}
							onPointerMove={handlePointerMove}
						>
							{viewportDimensions.w > 0 && (
								<img
									src={imageSrc}
									alt=""
									draggable={false}
									onLoad={(event) =>
										setImageDimensions({
											w: event.currentTarget.naturalWidth,
											h: event.currentTarget.naturalHeight,
										})
									}
									className="pointer-events-none absolute max-w-none"
									style={{
										left:
											viewportDimensions.w / 2 +
											clampedOffset.x -
											(imageDimensions.w * scale) / 2,
										top:
											viewportDimensions.h / 2 +
											clampedOffset.y -
											(imageDimensions.h * scale) / 2,
										width: imageDimensions.w * scale,
										height: imageDimensions.h * scale,
										transform: `rotate(${rotation}deg)`,
										transformOrigin: "center center",
									}}
								/>
							)}
							{cropSize > 0 && (
								<>
									<div
										className="pointer-events-none absolute inset-x-0 top-0 bg-black/60"
										style={{ height: cropTop }}
									/>
									<div
										className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60"
										style={{ height: viewportDimensions.h - cropTop - cropSize }}
									/>
									<div
										className="pointer-events-none absolute bg-black/60"
										style={{ left: 0, top: cropTop, width: cropLeft, height: cropSize }}
									/>
									<div
										className="pointer-events-none absolute right-0 bg-black/60"
										style={{
											top: cropTop,
											width: viewportDimensions.w - cropLeft - cropSize,
											height: cropSize,
										}}
									/>
									<div
										className="pointer-events-none absolute border-2 border-white/65"
										style={{
											left: cropLeft,
											top: cropTop,
											width: cropSize,
											height: cropSize,
										}}
									>
										{[1, 2].map((index) => (
											<div key={index}>
												<div
													className="absolute inset-y-0 border-l border-white/20"
													style={{ left: `${(100 / 3) * index}%` }}
												/>
												<div
													className="absolute inset-x-0 border-t border-white/20"
													style={{ top: `${(100 / 3) * index}%` }}
												/>
											</div>
										))}
									</div>
								</>
							)}
						</div>

						<div className="border-t border-white/10 bg-white/[0.02] px-4 py-3 sm:px-6">
							<div className="flex items-center gap-3">
								<ZoomOut className="h-4 w-4 shrink-0 text-white/35" />
								<input
									aria-label={t("avatarZoom")}
									type="range"
									min={minZoom}
									max={maxZoom}
									step="0.05"
									value={zoom}
									onChange={(event) => updateZoom(Number(event.target.value))}
									className="w-full accent-violet-300"
								/>
								<ZoomIn className="h-4 w-4 shrink-0 text-white/35" />
								<span className="w-12 text-right text-xs tabular-nums text-white/45">
									{zoomPercent}%
								</span>
							</div>
						</div>

						<div className="flex items-center justify-between gap-3 border-t border-white/10 bg-white/[0.015] px-4 py-3 sm:px-6">
							<div className="flex min-w-0 items-center gap-3">
								<div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">
									{cropSize > 0 && (
										<img
											src={imageSrc}
											alt=""
											draggable={false}
											className="pointer-events-none absolute max-w-none"
											style={{
												left:
													previewSize / 2 +
													clampedOffset.x * previewScale -
													(imageDimensions.w * previewScale * scale) / 2,
												top:
													previewSize / 2 +
													clampedOffset.y * previewScale -
													(imageDimensions.h * previewScale * scale) / 2,
												width: imageDimensions.w * previewScale * scale,
												height: imageDimensions.h * previewScale * scale,
												transform: `rotate(${rotation}deg)`,
												transformOrigin: "center center",
											}}
										/>
									)}
								</div>
								<div className="hidden min-w-0 sm:block">
									<p className="text-xs font-medium text-white/55">
										{t("avatarPreview")}
									</p>
									<p className="mt-1 text-[11px] text-white/30">{rotation}°</p>
								</div>
							</div>
							<div className="flex shrink-0 gap-2">
								<button
									type="button"
									onClick={() => rotate(-1)}
									disabled={saving}
									aria-label={t("avatarRotateCounterClockwise")}
									className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-xs font-medium text-white/55 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white disabled:opacity-40"
								>
									<RotateCcw className="h-3.5 w-3.5" />
									<span className="hidden md:inline">
										{t("avatarRotateCounterClockwise")}
									</span>
								</button>
								<button
									type="button"
									onClick={() => rotate(1)}
									disabled={saving}
									aria-label={t("avatarRotateClockwise")}
									className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-xs font-medium text-white/55 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white disabled:opacity-40"
								>
									<RotateCw className="h-3.5 w-3.5" />
									<span className="hidden md:inline">{t("avatarRotateClockwise")}</span>
								</button>
							</div>
						</div>

						<div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-6">
							<button
								type="button"
								onClick={clearSelectedFile}
								disabled={saving}
								className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white/45 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-40"
							>
								<Upload className="h-3.5 w-3.5" />
								{t("avatarChooseAnother")}
							</button>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={close}
									disabled={saving}
									className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/50 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-40"
								>
									{t("cancel")}
								</button>
								<button
									type="button"
									onClick={() => void saveCrop()}
									disabled={saving || !imageDimensions.w}
									className="inline-flex min-w-24 items-center justify-center gap-2 rounded-lg bg-violet-300 px-4 py-2 text-xs font-semibold text-black transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-45"
								>
									{saving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
									{saving ? t("avatarProcessing") : t("save")}
								</button>
							</div>
						</div>
					</>
				)}

				{error && (
					<p
						role="alert"
						className="border-t border-red-300/10 bg-red-400/[0.06] px-4 py-3 text-xs text-red-200 sm:px-6"
					>
						{error}
					</p>
				)}
				{file && imageSrc && (
					<p className="border-t border-white/8 px-4 py-2 text-[11px] text-white/25 sm:px-6">
						{file.name} · {formatFileSize(file.size)}
					</p>
				)}
			</div>
		</div>
	);
}
