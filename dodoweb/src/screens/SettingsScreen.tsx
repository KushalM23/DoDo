import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppIcon, type AppIconName } from "@/components/common/AppIcon";
import { cx } from "@/lib/tw";
import { deleteAccount, changePassword } from "@/services/api";
import { useAlert } from "@/providers/AlertContext";
import { useAuth } from "@/providers/AuthContext";
import { usePreferences } from "@/providers/PreferencesContext";
import { backOrReplace } from "@/utils/navigation";

type ToggleOption<T extends string> = {
  value: T;
  label: string;
  icon?: AppIconName;
};

function PillToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ToggleOption<T>[];
  onChange: (next: T) => void;
}) {
  const activeIdx = options.findIndex((option) => option.value === value);
  const safeIdx = activeIdx >= 0 ? activeIdx : 0;

  return (
    <div className="mb-5">
      <div className="relative overflow-hidden rounded-panel bg-surface p-1">
        <div className="pointer-events-none absolute inset-1">
          <span
            className="block h-full rounded-3xl bg-accent transition-transform duration-300 [transition-timing-function:cubic-bezier(0.2,0.9,0.2,1)]"
            style={{
              width: `${100 / options.length}%`,
              transform: `translateX(${safeIdx * 100}%)`,
            }}
          />
        </div>

        <div className="relative z-[1] flex">
          {options.map((option) => {
            const active = value === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className="flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-3xl px-3 py-2.5 focus:outline-none xl:min-h-12.5"
                onClick={() => onChange(option.value)}
              >
                {option.icon ? (
                  <AppIcon
                    name={option.icon}
                    size={14}
                    color={active ? "#fff" : "var(--muted-text)"}
                  />
                ) : null}
                <span
                  className={cx(
                    "text-sm font-sans-bold",
                    active ? "text-white" : "text-muted-text",
                  )}
                >
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type SettingsPanelProps = {
  embedded?: boolean;
};

const actionButtonBase =
  "flex min-h-[56px] w-full items-center justify-center gap-2 rounded-panel px-4 py-3.5 transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:transform-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 xl:min-h-[60px]";

const modalInputClass =
  "w-full rounded-full bg-surface-light px-5 py-2 text-base font-sans text-text placeholder:text-muted-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/45";

export function SettingsPanel({ embedded = false }: SettingsPanelProps) {
  const router = useRouter();
  const { showAlert } = useAlert();
  const { signOut } = useAuth();
  const {
    preferences,
    setDarkMode,
    setDateFormat,
    setTimeFormat,
    resetPreferences,
  } = usePreferences();

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [passwordNew, setPasswordNew] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function handlePasswordChange() {
    if (passwordNew.length < 6) {
      showAlert(
        "Invalid password",
        "New password must be at least 6 characters.",
      );
      return;
    }
    if (passwordNew !== passwordConfirm) {
      showAlert(
        "Passwords don't match",
        "New password and confirm password must match.",
      );
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(passwordNew);
      setPasswordCurrent("");
      setPasswordNew("");
      setPasswordConfirm("");
      setPasswordModalVisible(false);
      showAlert("Password updated", "Your password was changed successfully.");
    } catch (error) {
      showAlert(
        "Change failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      setChangingPassword(false);
    }
  }

  function openPasswordModal() {
    setPasswordCurrent("");
    setPasswordNew("");
    setPasswordConfirm("");
    setPasswordModalVisible(true);
  }

  function openDeleteModal() {
    setDeletePassword("");
    setDeleteModalVisible(true);
  }

  async function handleDeleteAccount() {
    if (!deletePassword) {
      showAlert(
        "Password required",
        "Please enter your password to delete your account.",
      );
      return;
    }
    setDeletingAccount(true);
    try {
      await deleteAccount();
      await signOut();
      router.replace("/login");
    } catch (error) {
      showAlert(
        "Delete failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      router.replace("/login");
    } catch (error) {
      showAlert(
        "Logout failed",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  function handleBack() {
    backOrReplace(router, "/tasks");
  }

  return (
    <section
      className={cx(
        "w-full xl:h-full",
        !embedded && "max-w-[560px]",
      )}
    >
      <div className="flex items-center justify-between px-7 py-1">
        {embedded ? (
          <div className="h-5.5 w-5.5" />
        ) : (
          <button
            type="button"
            onClick={handleBack}
            className="inline-grid h-5.5 w-5.5 place-items-center text-text focus:outline-none"
            aria-label="Back"
          >
            <AppIcon name="chevron-left" size={22} />
          </button>
        )}
        <div className="h-5.5 w-5.5" />
      </div>

      <div className="px-7 pb-6 xl:pb-8">
        <div className="mb-6 mt-6 flex items-center justify-between">
          <h3 className="m-0 font-display-semibold text-[20px] uppercase tracking-[1px] text-text">
            Preferences
          </h3>
          <button
            type="button"
            onClick={() => void resetPreferences()}
            className="inline-grid h-5.5 w-5.5 place-items-center text-text focus:outline-none"
            aria-label="Reset preferences"
          >
            <AppIcon name="rotate-ccw" size={20} />
          </button>
        </div>

        <PillToggle
          value={preferences.darkMode ? "dark" : "light"}
          options={[
            { value: "light", label: "Light", icon: "sun" },
            { value: "dark", label: "Dark", icon: "moon" },
          ]}
          onChange={(next) => {
            void setDarkMode(next === "dark");
          }}
        />

        <PillToggle
          value={preferences.dateFormat}
          options={[
            { value: "eu", label: "DD/MM/YYYY" },
            { value: "us", label: "MM/DD/YYYY" },
          ]}
          onChange={(next) => {
            void setDateFormat(next);
          }}
        />

        <PillToggle
          value={preferences.timeFormat}
          options={[
            { value: "12h", label: "12-hour" },
            { value: "24h", label: "24-hour" },
          ]}
          onChange={(next) => {
            void setTimeFormat(next);
          }}
        />

        <h3 className="mb-6 mt-6 font-display-semibold text-[20px] uppercase tracking-[1px] text-text">
          Account
        </h3>

        <div className="grid gap-2.5">
          <button
            type="button"
            className={cx(actionButtonBase, "bg-surface text-text")}
            onClick={() => void handleSignOut()}
          >
            <AppIcon name="log-out" size={14} />
            <span className="text-sm font-sans-bold">Logout</span>
          </button>

          <button
            type="button"
            className={cx(actionButtonBase, "bg-surface text-text")}
            onClick={openPasswordModal}
          >
            <AppIcon name="key-round" size={14} />
            <span className="text-sm font-sans-bold">Change password</span>
          </button>

          <button
            type="button"
            className={cx(actionButtonBase, "bg-danger text-white")}
            onClick={openDeleteModal}
          >
            <AppIcon name="trash-2" size={14} />
            <span className="text-sm font-sans-bold">Delete account</span>
          </button>
        </div>
      </div>

      {passwordModalVisible ? (
        <div className="fixed inset-0 z-50 grid place-items-center px-2">
          <div
            className="absolute inset-0 bg-black/90"
            onClick={() => setPasswordModalVisible(false)}
          />
          <div
            className="relative w-full max-w-[360px] rounded-control bg-surface shadow-[0_20px_40px_var(--shadow)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <h3 className="m-0 font-display text-[28px] tracking-[-0.5px] text-text">
                Change Password
              </h3>
              <button
                type="button"
                className="inline-grid h-8 w-8 place-items-center text-text focus:outline-none"
                onClick={() => setPasswordModalVisible(false)}
              >
                <AppIcon name="x" size={20} />
              </button>
            </div>

            <div className="grid gap-3 px-4 pb-5 pt-3">
              <input
                className={modalInputClass}
                type="password"
                placeholder="Current Password"
                value={passwordCurrent}
                onChange={(event) => setPasswordCurrent(event.target.value)}
                disabled={changingPassword}
              />
              <input
                className={modalInputClass}
                type="password"
                placeholder="New Password"
                value={passwordNew}
                onChange={(event) => setPasswordNew(event.target.value)}
                disabled={changingPassword}
              />
              <input
                className={modalInputClass}
                type="password"
                placeholder="Confirm New Password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                disabled={changingPassword}
              />

              <button
                type="button"
                className={cx(
                  actionButtonBase,
                  "mt-2 bg-accent text-white",
                  changingPassword && "opacity-60",
                )}
                disabled={changingPassword}
                onClick={() => void handlePasswordChange()}
              >
                <AppIcon name="key-round" size={14} />
                <span className="text-sm font-sans-bold">
                  {changingPassword ? "Saving..." : "Change password"}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteModalVisible ? (
        <div className="fixed inset-0 z-50 grid place-items-center px-2">
          <div
            className="absolute inset-0 bg-black/90"
            onClick={() => setDeleteModalVisible(false)}
          />
          <div
            className="relative w-full max-w-[360px] rounded-control bg-surface shadow-[0_20px_40px_var(--shadow)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <h3 className="m-0 font-display text-[28px] tracking-[-0.5px] text-text">
                Delete Account
              </h3>
              <button
                type="button"
                className="inline-grid h-8 w-8 place-items-center text-text focus:outline-none"
                onClick={() => setDeleteModalVisible(false)}
              >
                <AppIcon name="x" size={20} />
              </button>
            </div>

            <div className="grid gap-3 px-4 pb-5 pt-3">
              <p className="m-0 font-sans text-base text-muted-text">
                This permanently deletes your account and all related data. This
                action cannot be undone.
              </p>

              <input
                className={modalInputClass}
                type="password"
                placeholder="Current Password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                disabled={deletingAccount}
              />

              <button
                type="button"
                className={cx(
                  actionButtonBase,
                  "mt-2 bg-danger text-white",
                  deletingAccount && "opacity-60",
                )}
                disabled={deletingAccount}
                onClick={() => void handleDeleteAccount()}
              >
                <AppIcon name="trash-2" size={14} />
                <span className="text-sm font-sans-bold">
                  {deletingAccount ? "Deleting..." : "Delete account"}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function SettingsScreen() {
  return (
    <div className="grid h-full min-h-0 items-start justify-items-center pt-4">
      <SettingsPanel />
    </div>
  );
}
