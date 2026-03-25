import { Routes, Route } from 'react-router-dom';

function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-green-600">⚡ EV Bike Rental</h1>
        <p className="mt-4 text-lg text-gray-600">Find and rent electric bikes near you</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}
