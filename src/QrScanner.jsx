import { useEffect, useRef, useState, useId } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

const QrScanner = ({ onDecode, stopOnScan = false }) => {
	const regionId = `qr-region-${useId()}`;
	const qrRef = useRef(null);
	const scanningRef = useRef(false);
	const [message, setMessage] = useState('Grant camera permission…');
	const [cameras, setCameras] = useState([]);
	const [activeId, setActiveId] = useState(undefined);

	const populateCameras = async () => {
		try {
			const devices = await Html5Qrcode.getCameras();
			setCameras(devices);

			if (!activeId && devices.length) {
				const frontLike = devices.find((d) => /front|user|selfie/i.test(d.label));
				setActiveId(frontLike?.id || devices[0].id);
			}
		} catch (err) {
			console.warn('Unable to enumerate cameras', err);
		}
	};

	const start = async (deviceId) => {
		if (!qrRef.current) return;
		const cameraParam = deviceId ?? { facingMode: { exact: 'user' } };

		try {
			await qrRef.current.start(
				cameraParam,
				{ fps: 10, qrbox: 250, rememberLastUsedCamera: true },
				(decodedText) => {
					setMessage('QR value: ' + decodedText);
					navigator.vibrate?.(200);
					onDecode?.(decodedText);
					if (stopOnScan) stop();
				},
				() => {},
			);
			scanningRef.current = true;
			setMessage('Point the QR code toward the camera');
		} catch (err) {
			if (!deviceId && err.name === 'OverconstrainedError') {
				const devices = await Html5Qrcode.getCameras();
				if (devices.length) {
					const frontLike = devices.find((d) => /front|user|selfie/i.test(d.label)) || devices[0];
					setActiveId(frontLike.id);
					return start(frontLike.id);
				}
			}
			setMessage('Camera error: ' + err.message);
		}
	};

	// const stop = async () => {
	// 	try {
	// 		await qrRef.current.stop();
	// 		await qrRef.current.clear();
	// 	} catch (err) {
	// 		console.warn('Failed to stop QR scanner', err);
	// 	} finally {
	// 		scanningRef.current = false;
	// 	}
	// };

	const stop = async () => {
		if (!qrRef.current) return;
		try {
			const state = qrRef.current.getState?.();
			if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
				await qrRef.current.stop();
				await qrRef.current.clear();
				scanningRef.current = false;
			}
		} catch (err) {
			console.warn('Cannot stop scanner', err);
		}
	};

	useEffect(() => {
		qrRef.current = new Html5Qrcode(regionId, { verbose: false });
		populateCameras();
		start();

		const onVis = async () => {
			if (document.visibilityState === 'visible' && !scanningRef.current) {
				setMessage('Re-initialising camera…');
				await start(activeId);
			}
		};
		document.addEventListener('visibilitychange', onVis);

		return () => {
			document.removeEventListener('visibilitychange', onVis);
			stop();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleSwitch = async (id) => {
		setActiveId(id);
		await stop();
		await start(id);
	};

	return (
		<div style={{ display: 'grid', placeItems: 'center', gap: 8 }}>
			<div
				id={regionId}
				style={{
					width: '90vmin',
					maxWidth: 480,
					borderRadius: 12,
					overflow: 'hidden',
					boxShadow: '0 4px 20px rgba(0,0,0,.35)',
				}}
			/>
			{cameras.length > 1 && (
				<select
					value={activeId}
					onChange={(e) => handleSwitch(e.target.value)}
					style={{
						padding: '6px 8px',
						borderRadius: 8,
						border: '1px solid #ccc',
						marginTop: 8,
						background: '#fff',
					}}
				>
					{cameras.map((cam) => (
						<option key={cam.id} value={cam.id}>
							{cam.label || `Camera ${cam.id}`}
						</option>
					))}
				</select>
			)}
			<p style={{ color: '#333', textAlign: 'center' }}>{message}</p>
		</div>
	);
};

export default QrScanner;
