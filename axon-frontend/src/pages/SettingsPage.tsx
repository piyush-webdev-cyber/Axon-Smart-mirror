import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeProvider";
import { THEMES, THEME_LABELS } from "@/constants/themes";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/utils/cn";

/** Lightweight settings surface. Phase 1 exposes the theme switcher. */
export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="w-full max-w-xl animate-fade-in">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={ROUTES.home} aria-label="Back to mirror">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-fluid-lg font-light tracking-wide">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {THEMES.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setTheme(name)}
                className={cn(
                  "rounded-md border px-4 py-3 text-left text-fluid-sm transition-colors",
                  theme === name
                    ? "border-primary bg-primary/15 ring-glow"
                    : "border-border/50 bg-secondary/40 hover:bg-secondary/70",
                )}
              >
                {THEME_LABELS[name]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
