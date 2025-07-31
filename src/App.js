import React, { useState } from 'react';
import QrScanner from './QrScanner';

function App() {
	const [value, setValue] = useState('');

	return (
		<div style={{ padding: 20 }}>
			<h1>QR Scanner</h1>
			<QrScanner onDecode={(text) => setValue(text)} stopOnScan={false} />
			<div style={{ marginTop: 16 }}>
				<strong>Last scan:</strong> {value || '—'}
			</div>
		</div>
	);
}

export default App;
