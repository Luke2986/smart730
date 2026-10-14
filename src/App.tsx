import { Toaster } from "@/components/ui/toaster";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Smart730Provider } from "@/contexts/Smart730Context";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const App = () => (
  <Smart730Provider>
    <Toaster />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </Smart730Provider>
);

export default App;
