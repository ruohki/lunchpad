import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LINK_KINDS, type LinkKind, type LinkProvider, type StateLink } from "../lib/api";
import { NamePicker, ProviderStatus, useProviderView } from "./actions/ObsEditors";
import { Select } from "./Select";
import { useSettingsStore } from "../store/settings";

type ProviderChoice = LinkProvider | "none";

/** "Active while …" picker: app, state, and the scene / source it refers to. */
export function StateLinkField({ value, onChange }: { value: StateLink | null; onChange: (next: StateLink | null) => void }) {
  const { t } = useTranslation();
  const view = useProviderView(value?.provider ?? "obs");
  const { loaded, load } = view;

  useEffect(() => {
    if (value && !loaded) void load();
  }, [value, loaded, load]);

  const obsEnabled = useSettingsStore((s) => s.settings?.obs.enabled ?? false);
  const slobsEnabled = useSettingsStore((s) => s.settings?.slobs.enabled ?? false);
  const providerOptions: { value: ProviderChoice; label: string }[] = [
    { value: "none", label: t("editor.linkNone") },
    ...(obsEnabled || value?.provider === "obs" ? [{ value: "obs" as const, label: t("integrations.obs") }] : []),
    ...(slobsEnabled || value?.provider === "slobs" ? [{ value: "slobs" as const, label: t("integrations.slobs") }] : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 text-xs text-stage-400">
          {t("editor.linkApp")}
          <Select<ProviderChoice>
            size="sm"
            value={value ? value.provider : "none"}
            options={providerOptions}
            onChange={(v) => onChange(v === "none" ? null : { provider: v, kind: value?.kind ?? "scene", scene: value?.scene ?? "", source: value?.source ?? "" })}
          />
        </div>
        {value && (
          <div className="flex flex-col gap-1 text-xs text-stage-400">
            {t("editor.linkKind")}
            <Select<LinkKind> size="sm" value={value.kind} options={LINK_KINDS.map((k) => ({ value: k, label: t(`editor.linkKinds.${k}`) }))} onChange={(kind) => onChange({ ...value, kind })} />
          </div>
        )}
      </div>
      {value && (value.kind === "scene" || value.kind === "sourceVisible") && (
        <div className="grid grid-cols-2 gap-3">
          <NamePicker
            view={view}
            label={t("obs.scene")}
            value={value.scene}
            list={view.scenes}
            onChange={(scene) => onChange({ ...value, scene })}
            allowEmpty={value.kind === "sourceVisible" ? t("editor.linkCurrentScene") : undefined}
          />
          {value.kind === "sourceVisible" && <NamePicker view={view} label={t("obs.source")} value={value.source} list={view.sources} onChange={(source) => onChange({ ...value, source })} />}
        </div>
      )}
      {value && value.kind === "sourceMuted" && (
        <div className="max-w-xs">
          <NamePicker view={view} label={t("obs.source")} value={value.source} list={view.audioSources} onChange={(source) => onChange({ ...value, source })} />
        </div>
      )}
      {value && <ProviderStatus view={view} />}
    </div>
  );
}
