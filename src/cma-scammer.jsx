import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

// Mock URL constants since they're not defined
const URL = {
	BASE_URL: 'https://api.example.com',
	EXTERNAL: '/external',
	VERIFY: '/verify',
};

const CheckInQRScan = () => {
	const navigate = useNavigate();
	const [toastMessage, setToastMessage] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const regionId = 'qr-region-scanner';
	const qrRef = useRef(null);
	const scanningRef = useRef(false);
	const mountedRef = useRef(true);
	const initializingRef = useRef(false);
	const stoppingRef = useRef(false);

	const showToast = useCallback((msg, isCameraError = false) => {
		setToastMessage(msg);
		setTimeout(() => setToastMessage(''), 4000);
	}, []);

	const verifyCode = useCallback(
		async (codeStr) => {
			setIsLoading(true);
			try {
				const API_URL = `${URL.BASE_URL}${URL.EXTERNAL}/${URL.VERIFY}`;
				console.log('API_URL :', API_URL);
				const response = await fetch(API_URL, {
					method: 'POST',
					headers: {
						accept: 'application/octet-stream',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ code: codeStr }),
				});
				const data = await response.json();
				console.log('DATA :', data);
				if (response.ok && data?.result?.visitorId) {
					setTimeout(() => {
						navigate(`/confirm-details/${data.result.visitorId}`);
					}, 1000);
				} else {
					showToast('Code Not Recognized');
				}
			} catch (err) {
				console.error('API Error:', err);
				showToast('Code Not Recognized');
			} finally {
				setIsLoading(false);
			}
		},
		[navigate, showToast],
	);

	// Component state
	const [isScanning, setIsScanning] = useState(true);

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
				// setError(`Failed to stop scanner: ${err.message}`);
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
			console.log('DECODED TEXT outside:', decodedText);
			console.log('Decoded text length:', decodedText.length);
			console.log('Decoded text type:', typeof decodedText);
			console.log(
				'Decoded text char codes:',
				Array.from(decodedText).map((c) => c.charCodeAt(0)),
			);

			// Extract 4-digit number from the decoded text
			console.log('Attempting to match 4-digit pattern in:', decodedText);
			// Try multiple regex patterns to find 4-digit numbers
			let fourDigitMatch = decodedText.match(/\b\d{4}\b/);
			if (!fourDigitMatch) {
				// Try without word boundaries
				fourDigitMatch = decodedText.match(/\d{4}/);
			}
			if (!fourDigitMatch) {
				// Check if the entire decoded text is exactly 4 digits
				if (/^\d{4}$/.test(decodedText)) {
					fourDigitMatch = [decodedText];
				}
			}
			console.log('Regex match result:', fourDigitMatch);

			if (!fourDigitMatch) {
				console.log('No 4-digit number found in QR code:', decodedText);
				showToast('Invalid QR Code - Please scan a valid 4-digit code');
				return;
			}

			const fourDigitCode = fourDigitMatch[0];
			console.log('Extracted 4-digit code:', fourDigitCode);

			// setDecodedValue(decodedText);
			// setMessage(`QR Code Successfully Scanned!`);

			try {
				verifyCode(fourDigitCode);
				setIsScanning(false);

				// Stop scanning since we got a result
				if (stopOnScan) {
					stopScanning();
				}
			} catch (error) {
				console.error('Error processing QR code:', error);
			}
		},
		[stopOnScan, stopScanning, verifyCode, showToast],
	);

	/**
	 * Start the QR scanner with front camera
	 */
	const startScanning = useCallback(async () => {
		if (!qrRef.current || scanningRef.current || initializingRef.current || !mountedRef.current) return;

		try {
			initializingRef.current = true;
			// setMessage('Starting front camera...');
			// setError('');
			// setDecodedValue('');
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
			// setMessage('Point QR code toward the front camera');
		} catch (err) {
			// Only update state if component is still mounted
			if (mountedRef.current) {
				// setError(`Camera error: ${err.message}`);
				// setMessage('Failed to start front camera');
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
	// const restartScanning = useCallback(async () => {
	// 	await stopScanning();
	// 	// Add delay to ensure cleanup is complete
	// 	setTimeout(() => {
	// 		if (mountedRef.current) {
	// 			startScanning();
	// 		}
	// 	}, 1500);
	// }, [stopScanning, startScanning]);

	/**
	 * Handle visibility change to restart camera when tab becomes visible
	 */
	const handleVisibilityChange = useCallback(async () => {
		if (!mountedRef.current) return;

		if (document.visibilityState === 'visible' && !scanningRef.current && isScanning && !initializingRef.current) {
			// setMessage('Restarting front camera...');
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
	}, [startScanning, stopScanning, handleVisibilityChange]);

	return (
		<div className='min-h-screen bg-[#F9FAFB] p-4'>
			{/* Loading Overlay */}
			{isLoading && (
				<div className='fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50'>
					<div className='bg-white/95 backdrop-blur-md rounded-2xl p-8 flex flex-col items-center shadow-2xl border border-white/20'>
						<div className='relative'>
							<div className='animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-blue-500'></div>
							<div className='absolute inset-0 rounded-full h-16 w-16 border-4 border-transparent border-t-blue-400 animate-pulse'></div>
						</div>
						<p className='text-gray-600 font-medium mt-4 text-lg'>Verifying code...</p>
						<div className='flex space-x-1 mt-3'>
							<div className='w-2 h-2 bg-blue-500 rounded-full animate-bounce'></div>
							<div className='w-2 h-2 bg-blue-500 rounded-full animate-bounce' style={{ animationDelay: '0.1s' }}></div>
							<div className='w-2 h-2 bg-blue-500 rounded-full animate-bounce' style={{ animationDelay: '0.2s' }}></div>
						</div>
					</div>
				</div>
			)}

			{/* Back Button positioned in top-left corner */}
			<button
				className='flex items-center gap-2 font-inter font-normal text-xl leading-7 text-gray-700 mb-10 mt-5 ml-8'
				onClick={() => navigate('/')}
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '8px',
					fontSize: '20px',
					color: '#374151',
					background: 'none',
					border: 'none',
					cursor: 'pointer',
					padding: '8px',
					borderRadius: '8px',
					transition: 'background-color 0.2s ease',
				}}
				onMouseEnter={(e) => {
					e.target.style.backgroundColor = '#f3f4f6';
				}}
				onMouseLeave={(e) => {
					e.target.style.backgroundColor = 'transparent';
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

			{/* Centered content container */}
			<div className='flex justify-center'>
				<div className='w-full max-w-[600px]'>
					{/* White Card */}
					<div className='bg-[#F9FAFB] rounded-xl p-6 pt-4 w-full'>
						<div className='flex flex-col items-center'>
							{/* Icon */}

							<h1 className='text-[32px] font-semibold leading-[32px] tracking-normal text-center'>Scan QR Code</h1>
							<p className='font-inter font-normal text-[16px] leading-7 text-center text-[#727272] mt-4'>
								Align QR Code within frame to scan.
							</p>

							{/* Camera selection dropdown (if more than one) */}
							{/* {cameras.length > 1 && (
								<select
									value={selectedCameraId}
									onChange={(e) => setSelectedCameraId(e.target.value)}
									className='mt-4 mb-2 border rounded px-2 py-1 text-sm'
								>
									{cameras.map((cam) => (
										<option key={cam.id} value={cam.id}>
											{cam.label || `Camera ${cam.id}`}
										</option>
									))}
								</select>
							)} */}

							{/* Scanner */}
							<div
								id={regionId}
								className='w-full h-[300px] rounded-lg bg-black flex items-center justify-center mt-6 mb-6 overflow-hidden'
							>
								<span className='text-white text-sm'>Camera will open here</span>
							</div>

							{/* Toast Message */}
							{toastMessage && (
								<div className='mt-4 max-w-md w-full bg-white shadow-lg rounded-lg flex ring-1 ring-black ring-opacity-5 mx-auto'>
									<div className='flex-1 w-0 p-4'>
										<div className='flex items-start'>
											<div className='ml-3 flex-1'>
												<p className='text-sm font-semibold text-red-600'>
													{toastMessage.includes('camera') ||
													toastMessage.includes('permission') ||
													toastMessage.includes('No camera')
														? 'Camera Error'
														: 'QR Code Not Recognized'}
												</p>
												<p className='mt-1 text-sm text-gray-900'>
													{toastMessage.includes('camera') ||
													toastMessage.includes('permission') ||
													toastMessage.includes('No camera')
														? toastMessage
														: 'Check your email for your correct QR code.'}
												</p>
											</div>
										</div>
									</div>
								</div>
							)}

							{/* Info Box */}
							{/* <div className="bg-blue-50 rounded-lg p-4 w-full">
						<p className="text-sm font-semibold text-[#0A1F6B] mb-1">About Your QR Code</p>
						<p className="text-sm text-[#0A1F6B]">
							Your code was sent via email when your visit was scheduled and in a reminder 30
							minutes before your appointment.
						</p>
					</div> */}
							<div className=' p-4 w-full'>
								<p className='mt-[30%] text-base text-center leading-none text-[#505050]'>
									<span className='font-bold text-[10px]'>About Your Code</span>{' '}
									<span className='font-normal text-[10px]'>
										| Your code was sent in your visit confirmation and reminder emails.
									</span>
								</p>
							</div>
						</div>
						{/* Scanned Code Display */}
						{/* {scannedCode && (
							<div className='fixed bottom-4 left-1/2 -translate-x-1/2 bg-white text-blue-800 font-bold px-4 py-2 rounded-lg shadow-lg text-xl tracking-widest z-50'>
								Code: {scannedCode}
							</div>
						)} */}
					</div>
				</div>
			</div>
		</div>
	);
};

export default CheckInQRScan;
