import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ethers } from 'ethers';
import {
  getUserPosition,
  getHealthFactor,
  getUtilizationRate,
  getTokenBalance,
  getTokenInfo,
  getPrice,
  faucetToken,
  addresses,
} from '../utils/web3';
import { useWallet } from '../context/WalletContext';
import './Page.css';

export default function Dashboard() {
  const { user } = useWallet();
  const [position, setPosition] = useState({ collateral: 0n, debt: 0n });
  const [healthFactor, setHealthFactor] = useState(null);
  const [utilization, setUtilization] = useState(null);
  const [collateralBalance, setCollateralBalance] = useState(0n);
  const [borrowBalance, setBorrowBalance] = useState(0n);
  const [collateralInfo, setCollateralInfo] = useState({ decimals: 18, symbol: 'COL' });
  const [borrowInfo, setBorrowInfo] = useState({ decimals: 18, symbol: 'USD' });
  const [collateralPrice, setCollateralPrice] = useState(null);
  const [borrowPrice, setBorrowPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetError, setFaucetError] = useState(null);

  useEffect(() => {
    if (!user || !addresses.lendingPool) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const [pos, hf, util, colBal, borBal, colInfo, borInfo, colPr, borPr] = await Promise.all([
          getUserPosition(user),
          getHealthFactor(user),
          getUtilizationRate(),
          getTokenBalance(addresses.collateralAsset, user),
          getTokenBalance(addresses.borrowAsset, user),
          getTokenInfo(addresses.collateralAsset),
          getTokenInfo(addresses.borrowAsset),
          addresses.collateralAsset ? getPrice(addresses.collateralAsset) : null,
          addresses.borrowAsset ? getPrice(addresses.borrowAsset) : null,
        ]);
        if (cancelled) return;
        setPosition(pos);
        setHealthFactor(hf);
        setUtilization(util);
        setCollateralBalance(colBal);
        setBorrowBalance(borBal);
        setCollateralInfo(colInfo);
        setBorrowInfo(borInfo);
        setCollateralPrice(colPr);
        setBorrowPrice(borPr);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  const formatToken = (wei, decimals) => {
    if (wei === undefined || wei === null) return '0';
    try {
      const d = decimals !== undefined ? decimals : 18;
      return typeof wei === 'bigint' ? ethers.formatUnits(wei, d) : String(wei);
    } catch {
      return '0';
    }
  };
  let hfDisplay = '—';
  try {
    if (healthFactor != null && typeof healthFactor === 'bigint') {
      hfDisplay = Number(ethers.formatUnits(healthFactor, 18)).toFixed(2);
    }
  } catch {}
  const utilDisplay = utilization != null && (typeof utilization === 'bigint' || typeof utilization === 'number')
    ? (Number(utilization) / 100).toFixed(2) + '%' : '—';
  let collateralValue = 0;
  let debtValue = 0;
  try {
    if (position?.collateral != null && collateralPrice != null && typeof position.collateral === 'bigint' && typeof collateralPrice === 'bigint') {
      collateralValue = Number(ethers.formatUnits(position.collateral * collateralPrice, (collateralInfo?.decimals ?? 18) + 8));
    }
    if (position?.debt != null && borrowPrice != null && typeof position.debt === 'bigint' && typeof borrowPrice === 'bigint') {
      debtValue = Number(ethers.formatUnits(position.debt * borrowPrice, (borrowInfo?.decimals ?? 18) + 8));
    }
  } catch {}
  const isLiquidatable = healthFactor != null && typeof healthFactor === 'bigint' && healthFactor < ethers.parseUnits('1', 18);

  const handleFaucet = async () => {
    if (!addresses.collateralAsset || !addresses.borrowAsset) return;
    setFaucetError(null);
    setFaucetLoading(true);
    try {
      const colAmount = ethers.parseUnits('100', collateralInfo.decimals);
      const borAmount = ethers.parseUnits('10000', borrowInfo.decimals);
      await faucetToken(addresses.collateralAsset, colAmount);
      await faucetToken(addresses.borrowAsset, borAmount);
      const [colBal, borBal] = await Promise.all([
        getTokenBalance(addresses.collateralAsset, user),
        getTokenBalance(addresses.borrowAsset, user),
      ]);
      setCollateralBalance(colBal);
      setBorrowBalance(borBal);
    } catch (e) {
      setFaucetError(e?.message || 'Faucet failed');
    } finally {
      setFaucetLoading(false);
    }
  };

  if (loading) {
    return <div className="page"><p className="muted">Loading...</p></div>;
  }

  return (
    <div className="page">
      <h1>Dashboard</h1>
      {!user && (
        <p className="muted">Connect MetaMask to see your position and take action.</p>
      )}
      {user && (
        <>
          <section className="card grid-2">
            <div>
              <h3>Your position</h3>
              <p><strong>Collateral:</strong> {formatToken(position.collateral, collateralInfo.decimals)} {collateralInfo.symbol}</p>
              <p><strong>Debt:</strong> {formatToken(position.debt, borrowInfo.decimals)} {borrowInfo.symbol}</p>
              <p><strong>Collateral value (USD):</strong> ${collateralValue.toFixed(2)}</p>
              <p><strong>Debt value (USD):</strong> ${debtValue.toFixed(2)}</p>
            </div>
            <div>
              <h3>Health factor</h3>
              <p className={isLiquidatable ? 'danger' : 'success'}>
                Health factor: {hfDisplay} {isLiquidatable && '(Liquidatable)'}
              </p>
              <p className="muted">Utilization rate: {utilDisplay}</p>
            </div>
          </section>
          <section className="card">
            <h3>Wallet balances</h3>
            <p><strong>{collateralInfo.symbol}:</strong> {formatToken(collateralBalance, collateralInfo.decimals)}</p>
            <p><strong>{borrowInfo.symbol}:</strong> {formatToken(borrowBalance, borrowInfo.decimals)}</p>
            <p className="muted">测试用：点击下方按钮可领取 100 {collateralInfo.symbol} 和 10,000 {borrowInfo.symbol}。</p>
            <button type="button" className="btn" onClick={handleFaucet} disabled={faucetLoading}>
              {faucetLoading ? '领取中...' : '领取测试代币'}
            </button>
            {faucetError && <p className="danger">{faucetError}</p>}
          </section>
          <div className="actions">
            <Link to="/deposit" className="btn btn-primary">Deposit</Link>
            <Link to="/borrow" className="btn">Borrow</Link>
            <Link to="/repay" className="btn">Repay</Link>
            <Link to="/withdraw" className="btn">Withdraw</Link>
            <Link to="/flash-loan" className="btn">Flash Loan</Link>
            <Link to="/liquidate" className="btn">Liquidate</Link>
          </div>
        </>
      )}
    </div>
  );
}
