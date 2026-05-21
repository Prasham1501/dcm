/**
 * Print Wallet bridge — talks to the website backend (via the Electron main
 * process) so the credit balance on this PC always matches mehrgrewal.com.
 *
 * Rule of thumb enforced here:
 *   - No license key  -> printing disabled (the desktop is in free mode).
 *   - Balance < pages -> printing disabled.
 *   - Successful print -> balance debited exactly once per print job.
 */
window.DICOM_VIEWER = window.DICOM_VIEWER || {};

window.DICOM_VIEWER.PrintWallet = (function () {
    const api = (typeof window !== 'undefined' && window.electronAPI) || null;

    /** Estimate the credit cost for a print job given pages + color mode. */
    function estimateCost(pages, colorMode) {
        // Conservative default: 1 credit / page B&W, 5 credits / page colour.
        // Matches the per-page rates exposed on the marketing site.
        const perPage = (String(colorMode || '').toLowerCase().startsWith('color') || colorMode === 'rgb') ? 5 : 1;
        return Math.max(1, Math.ceil((pages || 1) * perPage));
    }

    /** GET balance from server. Returns { ok, balance, reason? } */
    async function getBalance() {
        if (!api?.getWalletBalance) return { ok: false, reason: 'no_bridge', balance: 0 };
        try { return await api.getWalletBalance('print'); }
        catch (e) { return { ok: false, reason: 'bridge_error', balance: 0 }; }
    }

    /** Check whether the user can print `pages` at the given color mode. */
    async function canPrint({ pages, colorMode }) {
        const cost = estimateCost(pages, colorMode);
        const bal  = await getBalance();
        if (!bal.ok) {
            // Map common reasons to user-friendly messages.
            const msg = bal.reason === 'no_license'
                ? 'No license activated. Activate Mediview Pro to print, or buy print credits from the dashboard.'
                : bal.reason === 'offline'
                    ? 'Cannot reach Mediview servers to verify credits. Connect to the internet and try again.'
                    : 'Print credits unavailable: ' + (bal.reason || 'unknown');
            return { allowed: false, cost, balance: 0, reason: bal.reason, message: msg };
        }
        if ((bal.balance | 0) < cost) {
            return {
                allowed: false, cost, balance: bal.balance | 0, reason: 'insufficient',
                message: `Not enough print credits (have ${bal.balance}, need ${cost}). Top up from the dashboard.`,
            };
        }
        return { allowed: true, cost, balance: bal.balance | 0 };
    }

    /** Spend credits after a successful print. Returns { ok, balance, reason? } */
    async function spend({ pages, colorMode, meta }) {
        if (!api?.spendWalletCredits) return { ok: false, reason: 'no_bridge' };
        const cost = estimateCost(pages, colorMode);
        try { return await api.spendWalletCredits(cost, 'print', meta || ''); }
        catch (e) { return { ok: false, reason: 'bridge_error' }; }
    }

    return { estimateCost, getBalance, canPrint, spend };
})();
