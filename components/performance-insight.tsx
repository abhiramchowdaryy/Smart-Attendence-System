import { Sparkles, Gauge, TrendingUp, Lightbulb, CircleDashed } from "lucide-react";
import {
  analyzePerformance,
  predictPerformance,
  type Band,
  type RiskLevel,
  type Likelihood,
} from "@/lib/performance";
import { Badge } from "@/components/ui/badge";
import { GradeBadge } from "@/components/grade-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * AI-style attendance ↔ performance insight card. Server-rendered and
 * presentation-only: all logic lives in lib/performance (unit-tested), so
 * this component just maps the verdict to the existing badge/token system.
 * State is conveyed by icon + label as well as colour (WCAG 1.4.1).
 */

const BAND_VARIANT: Record<Band, "present" | "late"> = {
  good: "present",
  low: "late",
};

const RISK_VARIANT: Record<RiskLevel, "present" | "late" | "absent"> = {
  Low: "present",
  Medium: "late",
  High: "absent",
};

const LIKELIHOOD_VARIANT: Record<Likelihood, "present" | "late" | "absent"> = {
  High: "present",
  Medium: "late",
  Low: "absent",
};

export function PerformanceInsight({
  attendancePct,
  marksPct,
  className,
}: {
  attendancePct: number | null;
  marksPct: number | null;
  className?: string;
}) {
  const analysis = analyzePerformance({ attendancePct, marksPct });
  const prediction = predictPerformance({ attendancePct, marksPct });

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            Performance insight
          </CardTitle>
          <CardDescription>
            How your attendance and marks track together — and what to do next.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        {analysis === null || prediction === null ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <CircleDashed className="size-4 shrink-0" aria-hidden="true" />
            Not enough data yet. Once you have both attendance and recorded
            marks, personalised guidance appears here.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Headline verdict + the two axis bands */}
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-base font-semibold">
                {analysis.headline}
              </p>
              <Badge variant={BAND_VARIANT[analysis.attendanceBand]}>
                Attendance {analysis.attendancePct}%
              </Badge>
              <Badge variant={BAND_VARIANT[analysis.marksBand]}>
                Marks {analysis.marksPct}%
              </Badge>
            </div>

            {/* Personalised feedback */}
            <p className="text-sm text-muted-foreground">{analysis.feedback}</p>

            {/* Prediction row */}
            <div className="grid gap-3 rounded-lg border bg-muted/40 p-3 sm:grid-cols-3">
              <div className="flex items-center gap-2">
                <TrendingUp
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Expected grade
                  </p>
                  <div className="mt-0.5">
                    <GradeBadge grade={prediction.expectedGrade} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Gauge
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Risk level
                  </p>
                  <div className="mt-0.5">
                    <Badge variant={RISK_VARIANT[prediction.riskLevel]}>
                      {prediction.riskLevel}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <TrendingUp
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Improvement odds
                  </p>
                  <div className="mt-0.5">
                    <Badge
                      variant={LIKELIHOOD_VARIANT[prediction.improvementProbability]}
                    >
                      {prediction.improvementProbability}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Recommended action */}
            <p className="flex items-start gap-2 rounded-md bg-primary/5 p-3 text-sm">
              <Lightbulb
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span>
                <span className="font-medium">Recommended action: </span>
                {prediction.recommendedAction}
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
