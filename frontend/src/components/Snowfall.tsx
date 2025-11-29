const Snowfall = () => {
    const snowflakes = Array.from({ length: 50 });
  
    return (
      // Changed z-0 to z-50 to force it on top of the background
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
        {snowflakes.map((_, i) => (
          <div
            key={i}
            className="absolute bg-white rounded-full opacity-40 dark:opacity-60 animate-snow"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-${Math.random() * 20}%`,
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              animationDuration: `${Math.random() * 10 + 10}s`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>
    );
  };
  
  export default Snowfall;