import React from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-canvas)',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'var(--font-sans)',
            color: 'var(--text-primary)'
        }}>
            {/* Navigation */}
            <nav style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '24px 5%',
                maxWidth: '1200px',
                width: '100%',
                margin: '0 auto'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        background: 'var(--brand-orange)',
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <svg width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 16L10 4L18 16" stroke="#FEFCF8" strokeWidth="1.5" strokeLinejoin="round" />
                            <path d="M5 16V11H15V16" stroke="#FEFCF8" strokeWidth="1.5" strokeLinejoin="round" />
                            <path d="M8 16V13H12V16" stroke="#FEFCF8" strokeWidth="1.5" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <span style={{ 
                        fontFamily: 'var(--font-serif)', 
                        fontSize: '22px', 
                        color: 'var(--text-primary)',
                        marginTop: '2px'
                    }}>
                        Ironwork
                    </span>
                </div>
                
                <div>
                    <Link to="/login" style={{
                        textDecoration: 'none',
                        color: '#fff',
                        backgroundColor: 'var(--brand-orange)',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontWeight: '500',
                        fontSize: '15px'
                    }}>
                        Sign in
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <main style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px 20px',
                textAlign: 'center',
                maxWidth: '800px',
                margin: '0 auto',
                gap: '24px'
            }}>
                <div style={{
                    fontSize: '12px',
                    letterSpacing: '1.5px',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    fontWeight: '500',
                    marginBottom: '16px'
                }}>
                    CONSTRUCTION · OPERATIONS · CREW
                </div>

                <h1 style={{
                    fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
                    lineHeight: '1.1',
                    fontFamily: 'var(--font-serif)',
                    color: 'var(--text-primary)',
                    margin: 0
                }}>
                    Build smarter, on <span style={{ color: 'var(--brand-orange)' }}>every site.</span>
                </h1>

                <p style={{
                    fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                    color: 'var(--text-secondary)',
                    maxWidth: '600px',
                    margin: '0 auto 16px',
                    lineHeight: '1.6'
                }}>
                    Ironwork is the command center for project managers, foremen, and field crews — one source of truth, from blueprint to handover.
                </p>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Link to="/login?tab=register" style={{
                        textDecoration: 'none',
                        fontSize: '16px',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        backgroundColor: '#000',
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontWeight: '500'
                    }}>
                        Get started <span style={{ marginLeft: '4px' }}>→</span>
                    </Link>
                </div>
            </main>
        </div>
    );
}
