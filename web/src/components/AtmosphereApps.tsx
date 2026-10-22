import { useState } from "react";
import { Pause, Play } from "lucide-react";

// App marks from Grain's public Atmosphere account explainer.
const apps = [
  {
    name: "Bluesky",
    src: "/atmosphere-icons/atmo-bluesky.jpg",
  },
  {
    name: "Tangled",
    src: "/atmosphere-icons/atmo-tangled.jpg",
  },
  {
    name: "Anisota",
    src: "/atmosphere-icons/atmo-anisota.jpg",
  },
  {
    name: "Beacon Bits",
    src: "/atmosphere-icons/atmo-beacon-bits.jpg",
  },
  {
    name: "Eurosky",
    src: "/atmosphere-icons/atmo-eurosky.jpg",
  },
  {
    name: "Flashes",
    src: "/atmosphere-icons/atmo-flashes.jpg",
  },
  {
    name: "Gander",
    src: "/atmosphere-icons/atmo-gander.jpg",
  },
  {
    name: "Germ",
    src: "/atmosphere-icons/atmo-germ.jpg",
  },
  {
    name: "Leaflet",
    src: "/atmosphere-icons/atmo-leaflet.jpg",
  },
  {
    name: "Northsky",
    src: "/atmosphere-icons/atmo-northsky.jpg",
  },
  {
    name: "Offprint",
    src: "/atmosphere-icons/atmo-offprint.jpg",
  },
  {
    name: "Pckt",
    src: "/atmosphere-icons/atmo-pckt.jpg",
  },
  {
    name: "Plyr",
    src: "/atmosphere-icons/atmo-plyr.jpg",
  },
  {
    name: "Popfeed",
    src: "/atmosphere-icons/atmo-popfeed.jpg",
  },
  {
    name: "Blento",
    src: "/atmosphere-icons/atmo-blento.jpg",
  },
  {
    name: "Semble",
    src: "/atmosphere-icons/atmo-semble.jpg",
  },
  {
    name: "Skylight",
    src: "/atmosphere-icons/atmo-skylight.jpg",
  },
  {
    name: "Blacksky",
    src: "/atmosphere-icons/atmo-blacksky.jpg",
  },
  {
    name: "Spark",
    src: "/atmosphere-icons/atmo-spark.png",
  },
  {
    name: "Streamplace",
    src: "/atmosphere-icons/atmo-stream-place.jpg",
  },
];

export default function AtmosphereApps() {
  const [paused, setPaused] = useState(false);
  return (
    <div className="atmosphere-apps">
      <div
        className="atmosphere-apps-strip"
        role="img"
        aria-label={`Apps in the Atmosphere: ${apps.map((app) => app.name).join(", ")}`}
      >
        <div
          className="atmosphere-apps-track"
          style={{ animationPlayState: paused ? "paused" : "running" }}
          aria-hidden="true"
        >
          {[0, 1].map((copy) => (
            <div className="atmosphere-apps-group" key={copy}>
              {apps.map((app) => (
                <img
                  key={app.name}
                  src={app.src}
                  alt=""
                  title={app.name}
                  width={36}
                  height={36}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="atmosphere-apps-footer">
        <a
          href="https://atmosphereaccount.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          What is an atmosphere account?
        </a>
        <button
          type="button"
          className="atmosphere-apps-pause"
          onClick={() => setPaused(!paused)}
          aria-label={paused ? "Play app animation" : "Pause app animation"}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
      </div>
    </div>
  );
}
