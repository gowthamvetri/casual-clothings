import React from "react";
import bannerImg from "../assets/loadingbanner3.jpg";

const HomeBanner = () => {
  return (
    <section className="relative w-full bg-black flex flex-col md:flex-row items-center justify-center overflow-hidden min-h-[400px] md:min-h-[500px] lg:min-h-[600px] px-0 md:px-0">
      {/* Left: Text */}
      <div className="flex-1 flex flex-col justify-center items-start px-6 md:px-12 py-10 md:py-0 z-10">
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold font-sans tracking-tight mb-4 uppercase text-white" style={{textShadow: '0 2px 8px rgba(0,0,0,0.4)'}}>
          MUSTARD SWEATER<br />WITH PEARLY CUFFS
        </h1>
        <p className="text-base md:text-lg lg:text-xl font-light mb-6 max-w-lg text-white/90 font-sans" style={{textShadow: '0 1px 4px rgba(0,0,0,0.3)'}}>
          Stand out in modern minimalism. Premium quality. Designed for comfort & style. Bring luxury to the basics.
        </p>
        <a
          href="/search"
          className="inline-block bg-white text-black font-semibold px-6 py-3 rounded-full shadow-lg hover:bg-gray-100 transition-all duration-200"
        >
          SHOP NOW
        </a>
      </div>
      {/* Right: Model Image (replace src with your image) */}
      <div className="flex-1 flex justify-center items-center w-full md:w-auto py-6 md:py-0">
        <img
          src={bannerImg}
          alt="Model wearing sweater"
          className="h-[250px] md:h-[350px] lg:h-[400px] object-contain drop-shadow-2xl"
          style={{maxWidth: '100%'}}
        />
      </div>
    </section>
  );
};

export default HomeBanner;
