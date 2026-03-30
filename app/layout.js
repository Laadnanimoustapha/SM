import "./globals.css";

export const metadata = {
  title: "SKYSHIELD — Integrated Air Defense Simulator",
  description: "Physics-based missile and air defense simulation using open-source weapons data. Real-time 2D visualization with ballistic trajectories, radar tracking, Pk calculations, and layered defense doctrine.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        
        {/* Load Scripts sequentially */}
        <script src="/js/weapons_data.js"></script>
        <script src="/js/entities.js"></script>
        <script src="/js/simulation.js"></script>
        <script src="/js/renderer.js"></script>
        <script src="/js/ui.js"></script>
        <script src="/js/main.js"></script>
      </body>
    </html>
  );
}
