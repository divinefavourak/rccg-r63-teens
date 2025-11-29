const Snowfall = () => {
    // Create 50 snowflakes with random positions and delays
    const snowflakes = Array.from({ length: 50 });
  
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        {snowflakes.map((_, i) => (
          <div
            key={i}
            className="absolute bg-white rounded-full opacity-20 dark:opacity-40 animate-snow"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-${Math.random() * 20}%`,
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              animationDuration: `${Math.random() * 10 + 10}s`, // Slower, more majestic fall
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>
    );
  };
  
  export default Snowfall;