import { useEffect, useState } from "react";
import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import ArtistsSection from "./components/ArtistsSection";
import ReleasesSection from "./components/ReleasesSection";
import AboutSection from "./components/AboutSection";
import ContactSection from "./components/ContactSection";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";

const STORAGE_KEY = "eklauta-auth-user";

function App() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = window.localStorage.getItem(STORAGE_KEY);

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const handleAuthenticated = (nextUser) => {
    setUser(nextUser);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    setAuthModalOpen(false);
  };

  const handleLogout = () => {
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="bg-stone-950 text-stone-100">
      <Header
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
      />
      <main>
        <HeroSection />
        <ArtistsSection />
        <ReleasesSection />
        <AboutSection />
        <ContactSection />
      </main>
      <Footer />
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
    </div>
  );
}

export default App;
