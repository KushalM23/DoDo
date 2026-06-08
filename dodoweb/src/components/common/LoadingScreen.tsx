import {cx, tw} from '@/lib/tw';

export function LoadingScreen({
  variant = 'screen',
  title = 'Loading',
  subtitle,
}: {
  variant?: 'app' | 'screen';
  title?: string;
  subtitle?: string;
}) {
  if (variant === 'app') {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-background">
        <div className="absolute inset-0 bg-accent dodo-loading-wipe" />

        <div className="relative z-[1] grid min-h-screen place-items-center px-6">
          <div className="grid justify-items-center gap-3 text-center dodo-loading-brand">
            <div className="grid h-[148px] w-[148px] place-items-center rounded-full">
              <img
                src="/dodo-icon.png"
                alt=""
                className="h-[148px] w-[148px] rounded-full"
              />
            </div>

            <strong className="font-sans-bold text-[34px] uppercase text-white">
              {title}
            </strong>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-full place-items-center bg-background p-6">
      <div className="grid justify-items-center gap-4 text-center">
        <div className="loader"></div>
        <div className="grid justify-items-center gap-2">
          <p className="m-0 text-xs font-sans-bold uppercase tracking-[0.28em] text-muted-text">
            {title}
          </p>
          {subtitle ? <p className={cx(tw.muted, 'text-sm')}>{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}

