import { Routes, Route } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import Home from './pages/Home';
import Live from './pages/Live';
import CaseStudyValencia from './pages/CaseStudyValencia';
import CaseStudyDana from './pages/CaseStudyDana';
import Wind from './pages/Wind';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={<Home />} />
        <Route path="live" element={<Live />} />
        <Route path="wind" element={<Wind />} />
        <Route path="case-studies/valencia-2021-2022" element={<CaseStudyValencia />} />
        <Route path="case-studies/dana-2024" element={<CaseStudyDana />} />
      </Route>
    </Routes>
  );
}
