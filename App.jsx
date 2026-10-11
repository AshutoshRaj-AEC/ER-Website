import { useEffect, useState } from "react";
import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import ArtistsSection from "./components/ArtistsSection";
import ReleasesSection from "./components/ReleasesSection";
import AboutSection from "./components/AboutSection";
import ContactSection from "./components/ContactSection";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";
import SubmitPage from "./components/SubmitPage";
import AdminPage from "./components/AdminPage";
import { getUserProfile, supabase } from "./lib/supabase";

// Sign-in used to live only in localStorage; clear what that version saved.
window.localStorage.removeItem("eklauta-auth-user");

const getRoute = () => window.location.pathname.replace(/\/+$/, "") || "/";

function App() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      return undefined;
    }

    let cancelled = false;

    // null while checking, so the admin page doesn't flash "not allowed".
    setIsAdmin(null);
    supabase.rpc("is_admin").then(({ data }) => {
      if (!cancelled) {
        setIsAdmin(data === true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleLogout = () => {
    supabase.auth.signOut();
  };

  const openAuth = () => setAuthModalOpen(true);
  const route = getRoute();

  let page;

  if (route === "/submit") {
    page = (
      <SubmitPage session={session} authReady={authReady} onOpenAuth={openAuth} />
    );
  } else if (route === "/admin") {
    page = (
      <AdminPage
        session={session}
        authReady={authReady}
        isAdmin={isAdmin}
        onOpenAuth={openAuth}
      />
    );
  } else {
    page = (
      <>
        <HeroSection />
        <ArtistsSection />
        <ReleasesSection />
        <AboutSection />
        <ContactSection />
      </>
    );
  }

  return (
    <div className="bg-stone-950 text-stone-100">
      <Header
        user={getUserProfile(session?.user)}
        isAdmin={isAdmin}
        onOpenAuth={openAuth}
        onLogout={handleLogout}
      />
      <main>{page}</main>
      <Footer />
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSignedIn={() => setAuthModalOpen(false)}
      />
    </div>
  );
}

export default App;
