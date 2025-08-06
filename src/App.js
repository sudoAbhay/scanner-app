import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import QrScanner from './QrScanner';
import CheckInQRScan from './cma-scammer';

// Landing page component with navigation buttons
const LandingPage = () => {
	const navigate = useNavigate();

	return (
		<div
			style={{
				padding: 20,
				minHeight: '100vh',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
				alignItems: 'center',
				backgroundColor: '#f8fafc',
				fontFamily: 'system-ui, -apple-system, sans-serif',
			}}
		>
			<div
				style={{
					backgroundColor: 'white',
					padding: '40px',
					borderRadius: '16px',
					boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
					textAlign: 'center',
					maxWidth: '500px',
					width: '100%',
				}}
			>
				<h1
					style={{
						fontSize: '32px',
						fontWeight: 'bold',
						color: '#1f2937',
						marginBottom: '8px',
					}}
				>
					QR Scanner App
				</h1>
				<p
					style={{
						color: '#6b7280',
						marginBottom: '40px',
						fontSize: '16px',
					}}
				>
					Choose your scanner type below
				</p>

				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						gap: '16px',
						width: '100%',
					}}
				>
					<button
						onClick={() => navigate('/og-scanner')}
						style={{
							padding: '16px 24px',
							fontSize: '18px',
							fontWeight: '600',
							color: '#ffffff',
							backgroundColor: '#3b82f6',
							border: 'none',
							borderRadius: '12px',
							cursor: 'pointer',
							transition: 'all 0.2s ease',
							boxShadow: '0 4px 6px rgba(59, 130, 246, 0.25)',
							width: '100%',
						}}
						onMouseEnter={(e) => {
							e.target.style.backgroundColor = '#2563eb';
							e.target.style.transform = 'translateY(-2px)';
							e.target.style.boxShadow = '0 6px 12px rgba(59, 130, 246, 0.35)';
						}}
						onMouseLeave={(e) => {
							e.target.style.backgroundColor = '#3b82f6';
							e.target.style.transform = 'translateY(0)';
							e.target.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.25)';
						}}
					>
						📱 OG Scanner
					</button>

					<button
						onClick={() => navigate('/cma-scanner')}
						style={{
							padding: '16px 24px',
							fontSize: '18px',
							fontWeight: '600',
							color: '#ffffff',
							backgroundColor: '#10b981',
							border: 'none',
							borderRadius: '12px',
							cursor: 'pointer',
							transition: 'all 0.2s ease',
							boxShadow: '0 4px 6px rgba(16, 185, 129, 0.25)',
							width: '100%',
						}}
						onMouseEnter={(e) => {
							e.target.style.backgroundColor = '#059669';
							e.target.style.transform = 'translateY(-2px)';
							e.target.style.boxShadow = '0 6px 12px rgba(16, 185, 129, 0.35)';
						}}
						onMouseLeave={(e) => {
							e.target.style.backgroundColor = '#10b981';
							e.target.style.transform = 'translateY(0)';
							e.target.style.boxShadow = '0 4px 6px rgba(16, 185, 129, 0.25)';
						}}
					>
						🏢 CMA Scanner
					</button>
				</div>
			</div>
		</div>
	);
};

function App() {
	return (
		<Router>
			<Routes>
				<Route path='/' element={<LandingPage />} />
				<Route path='/og-scanner' element={<QrScanner />} />
				<Route path='/cma-scanner' element={<CheckInQRScan />} />
			</Routes>
		</Router>
	);
}

export default App;
