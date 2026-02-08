'use client';

import { motion } from 'framer-motion';

export function Logo() {
    return (
        <motion.div
            className="relative w-12 h-12"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
        >
            {/* Outer glow */}
            <motion.div
                className="absolute inset-0 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl blur-lg opacity-50"
                animate={{
                    opacity: [0.3, 0.6, 0.3],
                    scale: [1, 1.1, 1],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
            />

            {/* Main container */}
            <div className="relative w-full h-full bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center overflow-hidden">
                {/* Inner pattern */}
                <svg
                    viewBox="0 0 48 48"
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    {/* Central node */}
                    <circle cx="24" cy="24" r="4" fill="currentColor" />

                    {/* Outer nodes */}
                    <motion.circle
                        cx="24"
                        cy="8"
                        r="3"
                        fill="currentColor"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0 }}
                    />
                    <motion.circle
                        cx="38"
                        cy="18"
                        r="3"
                        fill="currentColor"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                    />
                    <motion.circle
                        cx="38"
                        cy="34"
                        r="3"
                        fill="currentColor"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
                    />
                    <motion.circle
                        cx="24"
                        cy="42"
                        r="3"
                        fill="currentColor"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0.9 }}
                    />
                    <motion.circle
                        cx="10"
                        cy="34"
                        r="3"
                        fill="currentColor"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 1.2 }}
                    />
                    <motion.circle
                        cx="10"
                        cy="18"
                        r="3"
                        fill="currentColor"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
                    />

                    {/* Connections */}
                    <line x1="24" y1="20" x2="24" y2="11" opacity="0.6" />
                    <line x1="27" y1="21" x2="35" y2="17" opacity="0.6" />
                    <line x1="27" y1="27" x2="35" y2="33" opacity="0.6" />
                    <line x1="24" y1="28" x2="24" y2="39" opacity="0.6" />
                    <line x1="21" y1="27" x2="13" y2="33" opacity="0.6" />
                    <line x1="21" y1="21" x2="13" y2="17" opacity="0.6" />
                </svg>

                {/* Shine effect */}
                <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{
                        x: ['-100%', '100%'],
                    }}
                    transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'linear',
                        repeatDelay: 2,
                    }}
                />
            </div>
        </motion.div>
    );
}
