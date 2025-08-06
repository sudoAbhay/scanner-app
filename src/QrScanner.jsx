import { useEffect, useRef, useState, useId, useCallback, useMemo } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';

/**
 * Self-contained QR Scanner component that exclusively uses the front camera
 * Handles QR code detection and display internally without requiring external props
 */
const QrScanner = () => {
	const navigate = useNavigate();
	const regionId = `qr-region-${useId()}`;
	const qrRef = useRef(null);
	const scanningRef = useRef(false);
	const mountedRef = useRef(true);
	const initializingRef = useRef(false);
	const stoppingRef = useRef(false);

	// Component state
	const [message, setMessage] = useState('Initializing front camera...');
	const [error, setError] = useState('');
	const [decodedValue, setDecodedValue] = useState('');
	const [isScanning, setIsScanning] = useState(true);

	// Internal configuration - memoized to prevent re-creation on every render
	const scannerConfig = useMemo(() => ({ fps: 10, qrbox: 250 }), []);
	const stopOnScan = true;

	/**
	 * Find and return the front camera device
	 * @returns {Promise<string|null>} Front camera device ID or null if not found
	 */
	const getFrontCamera = useCallback(async () => {
		try {
			const devices = await Html5Qrcode.getCameras();

			if (!devices.length) {
				throw new Error('No cameras found on this device');
			}

			// Look for front camera by label patterns
			const frontCamera = devices.find((device) => /front|user|selfie|facing.*user/i.test(device.label));

			if (frontCamera) {
				return frontCamera.id;
			}

			// If no front camera found by label, try the first camera
			// (on mobile devices, this is often the front camera)
			return devices[0].id;
		} catch (err) {
			throw new Error(`Camera access failed: ${err.message}`);
		}
	}, []);

	/**
	 * Stop the QR scanner with proper cleanup
	 */
	const stopScanning = useCallback(async () => {
		if (!qrRef.current || stoppingRef.current) return;

		try {
			stoppingRef.current = true;
			scanningRef.current = false;

			const state = qrRef.current.getState?.();

			if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
				// Stop the scanner first
				await qrRef.current.stop();

				// Clear the scanner to release video resources
				await qrRef.current.clear();
			}

			// Additional cleanup: stop all video tracks
			try {
				const videoElement = document.querySelector(`#${regionId} video`);
				if (videoElement && videoElement.srcObject) {
					const stream = videoElement.srcObject;
					const tracks = stream.getTracks();
					tracks.forEach((track) => {
						track.stop();
					});
					videoElement.srcObject = null;
				}
			} catch (cleanupErr) {
				// Silent cleanup error
			}

			// Only update state if component is still mounted
			if (mountedRef.current) {
				setIsScanning(false);
			}
		} catch (err) {
			// Don't set error state if component is unmounted
			if (mountedRef.current) {
				setError(`Failed to stop scanner: ${err.message}`);
			}
		} finally {
			stoppingRef.current = false;
		}
	}, [regionId]);

	/**
	 * Handle QR code detection
	 */
	const handleQrDecode = useCallback(
		(decodedText) => {
			// Only update state if component is still mounted
			if (!mountedRef.current) return;

			setDecodedValue(decodedText);
			setMessage(`QR Code Successfully Scanned!`);
			setIsScanning(false);

			// Provide haptic feedback if available
			if (navigator.vibrate) {
				navigator.vibrate(200);
			}

			// Stop scanning since we got a result
			if (stopOnScan) {
				stopScanning();
			}
		},
		[stopOnScan, stopScanning],
	);

	/**
	 * Start the QR scanner with front camera
	 */
	const startScanning = useCallback(async () => {
		if (!qrRef.current || scanningRef.current || initializingRef.current || !mountedRef.current) return;

		try {
			initializingRef.current = true;
			setMessage('Starting front camera...');
			setError('');
			setDecodedValue('');
			setIsScanning(true);

			const frontCameraId = await getFrontCamera();

			if (!frontCameraId) {
				throw new Error('Front camera not available');
			}

			// Check if scanner is already in a scanning state
			const currentState = qrRef.current.getState?.();
			if (currentState === Html5QrcodeScannerState.SCANNING) {
				return;
			}

			await qrRef.current.start(
				frontCameraId,
				{
					...scannerConfig,
					rememberLastUsedCamera: false, // Don't remember camera since we always want front
				},
				handleQrDecode,
				(errorMessage) => {
					// Handle scan errors silently (this fires frequently during scanning)
				},
			);

			scanningRef.current = true;
			setMessage('Point QR code toward the front camera');
		} catch (err) {
			// Only update state if component is still mounted
			if (mountedRef.current) {
				setError(`Camera error: ${err.message}`);
				setMessage('Failed to start front camera');
				setIsScanning(false);
			}
			scanningRef.current = false;
		} finally {
			initializingRef.current = false;
		}
	}, [getFrontCamera, handleQrDecode, scannerConfig]);

	/**
	 * Restart scanning
	 */
	const restartScanning = useCallback(async () => {
		await stopScanning();
		// Add delay to ensure cleanup is complete
		setTimeout(() => {
			if (mountedRef.current) {
				startScanning();
			}
		}, 1500);
	}, [stopScanning, startScanning]);

	/**
	 * Handle visibility change to restart camera when tab becomes visible
	 */
	const handleVisibilityChange = useCallback(async () => {
		if (!mountedRef.current) return;

		if (document.visibilityState === 'visible' && !scanningRef.current && isScanning && !initializingRef.current) {
			setMessage('Restarting front camera...');
			await startScanning();
		} else if (document.visibilityState === 'hidden' && scanningRef.current) {
			await stopScanning();
		}
	}, [startScanning, stopScanning, isScanning]);

	/**
	 * Initialize scanner on component mount
	 */
	useEffect(() => {
		// Prevent multiple initializations
		if (qrRef.current) {
			return;
		}

		mountedRef.current = true;
		initializingRef.current = false;
		stoppingRef.current = false;

		// Initialize HTML5 QR code scanner
		qrRef.current = new Html5Qrcode(regionId, {
			verbose: false,
			useBarCodeDetectorIfSupported: true, // Use native barcode detector if available
		});

		// Start scanning
		startScanning();

		// Add visibility change listener
		document.addEventListener('visibilitychange', handleVisibilityChange);

		// Cleanup on unmount
		return () => {
			mountedRef.current = false;
			initializingRef.current = false;
			document.removeEventListener('visibilitychange', handleVisibilityChange);

			// Ensure scanner is stopped before component unmounts
			if (qrRef.current && scanningRef.current) {
				stopScanning().catch((err) => {
					// Silent cleanup error
				});
			}
		};
	}, [startScanning, stopScanning, handleVisibilityChange, regionId]);

	return (
		<div
			className='qr-scanner-container'
			style={{
				display: 'grid',
				placeItems: 'center',
				gap: 16,
				padding: '20px',
				fontFamily: 'system-ui, -apple-system, sans-serif',
				position: 'relative',
			}}
		>
			{/* Back Button */}
			<button
				onClick={() => navigate('/')}
				style={{
					position: 'absolute',
					top: '20px',
					left: '20px',
					display: 'flex',
					alignItems: 'center',
					gap: '8px',
					fontSize: '18px',
					color: '#374151',
					background: 'rgba(255, 255, 255, 0.9)',
					border: 'none',
					cursor: 'pointer',
					padding: '12px 16px',
					borderRadius: '8px',
					transition: 'all 0.2s ease',
					boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
					zIndex: 10,
				}}
				onMouseEnter={(e) => {
					e.target.style.backgroundColor = 'rgba(255, 255, 255, 1)';
					e.target.style.transform = 'translateY(-1px)';
				}}
				onMouseLeave={(e) => {
					e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
					e.target.style.transform = 'translateY(0)';
				}}
			>
				<svg
					width='20'
					height='20'
					viewBox='0 0 24 24'
					fill='none'
					stroke='currentColor'
					strokeWidth='2'
					strokeLinecap='round'
					strokeLinejoin='round'
				>
					<path d='M19 12H5M12 19l-7-7 7-7' />
				</svg>
				Back
			</button>
			<div
				id={regionId}
				className='qr-scanner-region'
				style={{
					width: '90vmin',
					maxWidth: 480,
					borderRadius: 12,
					overflow: 'hidden',
					boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
					backgroundColor: '#000',
				}}
			/>

			<div className='qr-scanner-status' style={{ textAlign: 'center', maxWidth: 480 }}>
				<p
					style={{
						color: '#333',
						margin: '0 0 12px 0',
						fontSize: '16px',
						fontWeight: '500',
					}}
				>
					{message}
				</p>

				{error && (
					<div
						style={{
							color: '#dc2626',
							fontWeight: 'bold',
							margin: '12px 0',
							padding: '12px',
							backgroundColor: '#fef2f2',
							border: '1px solid #fecaca',
							borderRadius: '8px',
							fontSize: '14px',
						}}
						role='alert'
						aria-live='polite'
					>
						{error}
					</div>
				)}

				{decodedValue && (
					<div
						style={{
							margin: '16px 0',
							padding: '16px',
							backgroundColor: '#f0f9ff',
							border: '2px solid #0ea5e9',
							borderRadius: '8px',
						}}
					>
						<h3
							style={{
								margin: '0 0 8px 0',
								color: '#0c4a6e',
								fontSize: '18px',
							}}
						>
							QR Code Result:
						</h3>
						<p
							style={{
								margin: 0,
								color: '#164e63',
								fontSize: '16px',
								fontFamily: 'monospace',
								wordBreak: 'break-all',
								backgroundColor: '#ffffff',
								padding: '8px',
								borderRadius: '4px',
								border: '1px solid #e0f2fe',
							}}
						>
							{decodedValue}
						</p>
					</div>
				)}

				{!isScanning && decodedValue && (
					<button
						onClick={restartScanning}
						style={{
							padding: '12px 24px',
							fontSize: '16px',
							fontWeight: '500',
							color: '#fff',
							backgroundColor: '#059669',
							border: 'none',
							borderRadius: '8px',
							cursor: 'pointer',
							transition: 'all 0.2s ease',
							boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
						}}
						onMouseEnter={(e) => {
							e.target.style.backgroundColor = '#047857';
							e.target.style.transform = 'translateY(-1px)';
						}}
						onMouseLeave={(e) => {
							e.target.style.backgroundColor = '#059669';
							e.target.style.transform = 'translateY(0)';
						}}
					>
						Scan Another QR Code
					</button>
				)}
			</div>
		</div>
	);
};

export default QrScanner;
