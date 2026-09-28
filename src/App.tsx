import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import FlagEliminationBattlePage from "./pages/FlagEliminationBattlePage";
import AllCountryFlagsPage from "./pages/AllCountryFlagsPage";
import NotFound from "./pages/NotFound";

const App = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/battle" element={<FlagEliminationBattlePage />} />
      <Route path="/all-flags" element={<AllCountryFlagsPage />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
