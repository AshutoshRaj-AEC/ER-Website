import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import ArtistsSection from "./components/ArtistsSection";
import ReleasesSection from "./components/ReleasesSection";
import AboutSection from "./components/AboutSection";
import ContactSection from "./components/ContactSection";
import Footer from "./components/Footer";

function App() {
  return (
    <div className="bg-stone-950 text-stone-100">
      <Header />
      <main>
        <HeroSection />
        <ArtistsSection />
        <ReleasesSection />
        <AboutSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}

export default App;
