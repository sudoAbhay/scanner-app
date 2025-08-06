import { useEffect, useRef, useState, useId, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

/**
 * Self-contained QR Scanner component that exclusively uses the front camera
 * Handles QR code detection and display internally without requiring external props
 */
const QrScanner = () => {
	const regionId = `qr-region-${useId()}`;
	const qrRef = useRef(null);
	const scanningRef = useRef(false);

	// Component state
	const [message, setMessage] = useState('Initializing front camera...');
	const [error, setError] = useState('');
	const [decodedValue, setDecodedValue] = useState('');
	const [isScanning, setIsScanning] = useState(true);

	// Internal configuration
	const scannerConfig = { fps: 10, qrbox: 250 };
	const stopOnScan = true;

	/**
	 * Find and return the front camera device
	 * @returns {Promise<string|null>} Front camera device ID or null if not found
	 */
	const getFrontCamera = useCallback(async () => {
		try {
			console.log('Searching for front camera...');
			const devices = await Html5Qrcode.getCameras();

			if (!devices.length) {
				throw new Error('No cameras found on this device');
			}

			// Look for front camera by label patterns
			const frontCamera = devices.find((device) => /front|user|selfie|facing.*user/i.test(device.label));

			if (frontCamera) {
				console.log('Front camera found:', frontCamera.label);
				return frontCamera.id;
			}

			// If no front camera found by label, try the first camera
			// (on mobile devices, this is often the front camera)
			console.warn('No front camera identified by label, using first available camera');
			return devices[0].id;
		} catch (err) {
			console.error('Error accessing cameras:', err);
			throw new Error(`Camera access failed: ${err.message}`);
		}
	}, []);

	/**
	 * Handle QR code detection
	 */
	const handleQrDecode = useCallback(
		(decodedText) => {
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
		[stopOnScan],
	);

	/**
	 * Start the QR scanner with front camera
	 */
	const startScanning = useCallback(async () => {
		if (!qrRef.current || scanningRef.current) return;

		try {
			setMessage('Starting front camera...');
			setError('');
			setDecodedValue('');
			setIsScanning(true);

			const frontCameraId = await getFrontCamera();

			if (!frontCameraId) {
				throw new Error('Front camera not available');
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
					console.debug('Scan error:', errorMessage);
				},
			);

			scanningRef.current = true;
			setMessage('Point QR code toward the front camera');
		} catch (err) {
			console.error('Failed to start scanner:', err);
			setError(`Camera error: ${err.message}`);
			setMessage('Failed to start front camera');
			setIsScanning(false);
			scanningRef.current = false;
		}
	}, [getFrontCamera, handleQrDecode, scannerConfig]);

	/**
	 * Stop the QR scanner
	 */
	const stopScanning = useCallback(async () => {
		if (!qrRef.current || !scanningRef.current) return;

		try {
			const state = qrRef.current.getState?.();

			if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
				await qrRef.current.stop();
				await qrRef.current.clear();
			}

			scanningRef.current = false;
			setIsScanning(false);
		} catch (err) {
			console.warn('Error stopping scanner:', err);
			setError(`Failed to stop scanner: ${err.message}`);
		}
	}, []);

	/**
	 * Restart scanning
	 */
	const restartScanning = useCallback(async () => {
		await stopScanning();
		setTimeout(() => {
			startScanning();
		}, 500);
	}, [stopScanning, startScanning]);

	/**
	 * Handle visibility change to restart camera when tab becomes visible
	 */
	const handleVisibilityChange = useCallback(async () => {
		if (document.visibilityState === 'visible' && !scanningRef.current && isScanning) {
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
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			stopScanning();
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
			}}
		>
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
