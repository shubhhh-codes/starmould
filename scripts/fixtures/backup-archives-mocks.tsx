import React from 'react';
export function AppLayout({children}: {children: React.ReactNode}) {return <main>{children}</main>;}
export function useAuth() {return {currentUser:{id:1,role_id:0}};}
