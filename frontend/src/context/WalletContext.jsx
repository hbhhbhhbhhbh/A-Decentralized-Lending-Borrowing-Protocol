import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getAccount } from '../utils/web3';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [user, setUser] = useState(null);

  const refreshUser = useCallback(async () => {
    const acc = await getAccount();
    setUser(acc);
    return acc;
  }, []);

  useEffect(() => {
    refreshUser();
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', refreshUser);
      window.ethereum.on('chainChanged', () => window.location.reload());
      return () => {
        window.ethereum.removeListener('accountsChanged', refreshUser);
      };
    }
  }, [refreshUser]);

  return (
    <WalletContext.Provider value={{ user, setUser, refreshUser }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
