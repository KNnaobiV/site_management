const Spinner = () => (
    <div
        style={{
            width: '20px',
            height: '20px',
            border: '3px solid rgba(255,255,255,0.2)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
        }}
    />
);

export default Spinner;