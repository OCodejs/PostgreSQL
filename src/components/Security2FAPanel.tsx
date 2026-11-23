import React, { useState } from 'react';
import { CheckCircle2, KeyRound, Lock, RotateCw, ShieldAlert } from 'lucide-react';
import { ClusterConfig, Language, TeamMemberSecurity } from '../types/infra';
import { Translations } from '../i18n/translations';

interface Security2FAPanelProps {
  t: Translations;
  lang: Language;
  config: ClusterConfig;
  team: TeamMemberSecurity[];
  onToggleMember2FA: (id: string) => void;
  keyVersion: number;
  onRotateKeys: () => void;
  twoFactorVerified: boolean;
  onVerifyTotpSuccess: () => void;
}

export const Security2FAPanel: React.FC<Security2FAPanelProps> = ({
  t,
  lang,
  config,
  team,
  onToggleMember2FA,
  keyVersion,
  onRotateKeys,
  twoFactorVerified,
  onVerifyTotpSuccess,
}) => {
  const [totpInput, setTotpInput] = useState('');
  const [totpInvalid, setTotpInvalid] = useState(false);

  const handleVerifyTotp = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^\d{6}$/.test(totpInput.trim())) {
      setTotpInvalid(false);
      onVerifyTotpSuccess();
    } else {
      setTotpInvalid(true);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
          {t.security.title}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
          {t.security.subtitle}
        </p>
      </div>

      {/* E2EE + TLS + TOTP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {t.security.e2eeTitle}
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.security.e2eeDesc}
            </p>
            <p className="text-xs font-mono text-slate-700 dark:text-slate-300 pt-1">
              AES-256-GCM · KMS Key v{keyVersion} · Ed25519
            </p>
          </div>
          <button
            type="button"
            onClick={onRotateKeys}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>{t.actions.rotateKeys}</span>
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t.security.tlsTitle}
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {t.security.tlsDesc}
          </p>
          <div className="pt-2 space-y-1 text-xs font-mono text-slate-700 dark:text-slate-300">
            <p>PostgreSQL: sslmode={config.tlsMode} · TLSv1.3</p>
            <p>Auth: scram-sha-256 + clientcert</p>
            <p>Redis: rediss://:6379 · mTLS CA</p>
          </div>
        </div>

        <form
          onSubmit={handleVerifyTotp}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
        >
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t.security.tfaTitle}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {t.security.totpPrompt}
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={totpInput}
              onChange={(e) => {
                setTotpInput(e.target.value);
                setTotpInvalid(false);
              }}
              placeholder={t.security.totpPlaceholder}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-sm tracking-widest text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors whitespace-nowrap"
            >
              {t.actions.verifyCode}
            </button>
          </div>

          {twoFactorVerified && !totpInvalid && (
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{t.security.totpSuccess}</span>
            </p>
          )}
          {totpInvalid && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>{t.security.totpError}</span>
            </p>
          )}
        </form>
      </div>

      {/* Team 2FA Security Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t.security.teamTableTitle}
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4 whitespace-nowrap">{t.security.colMember}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t.security.colRole}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t.security.col2FA}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t.security.colFingerprint}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t.security.colLastActive}</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {team.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {member.email}
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {member.role}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {member.twoFactorEnabled ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t.security.enabled}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>{t.security.pending}</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {member.keyFingerprint}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {member.lastActive}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onToggleMember2FA(member.id)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      {member.twoFactorEnabled
                        ? lang === 'vi'
                          ? 'Đặt lại 2FA'
                          : 'Reset 2FA'
                        : t.actions.enable2FA}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
