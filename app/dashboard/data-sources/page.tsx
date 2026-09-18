"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { dataSourceConfig, formatDateTime } from "@/lib/mock-data";
import { ServerIcon, CheckCircleIcon, ClockIcon, AlertCircleIcon, PlusIcon, SettingsIcon, DatabaseIcon, RefreshCwIcon } from "@/components/dashboard/Icons";

export default function DataSourcesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-white">Data Sources</h1>
          <p className="mt-1 text-gray-400">Configure and manage your transaction data sources.</p>
        </div>
        <Button>
          <PlusIcon className="mr-2" />
          Add Data Source
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(dataSourceConfig).map(([key, config]) => (
          <Card key={key} padding="lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{config.name}</CardTitle>
                <StatusBadge status={config.status === "connected" ? "COMPLETED" : config.status === "pending" ? "QUEUED" : "FAILED"} size="sm" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-3xl", config.status === "connected" && "bg-green-500/10", config.status === "pending" && "bg-amber-500/10", config.status === "disconnected" && "bg-red-500/10")}>
                  {config.icon}
                </div>
                <div>
                  <p className="text-sm text-gray-400">{config.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {config.status === "connected" ? (
                      <>
                        <CheckCircleIcon className="inline w-3 h-3 text-green-400 mr-1" /> Last sync: {config.lastSync ? formatDateTime(config.lastSync) : "Never"}
                      </>
                    ) : config.status === "pending" ? (
                      <>
                        <ClockIcon className="inline w-3 h-3 text-amber-400 mr-1" /> Pending configuration
                      </>
                    ) : (
                      <>
                        <AlertCircleIcon className="inline w-3 h-3 text-red-400 mr-1" /> Not connected
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-navy-600 flex items-center justify-between">
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <RefreshCwIcon className="w-4 h-4" />
                  Sync Now
                </Button>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4" />
                  Configure
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Future Integrations (Coming Soon)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "REST APIs", description: "Direct API connections to payment providers and banks", icon: "🔌" },
              { name: "Webhooks", description: "Real-time transaction notifications", icon: "🪝" },
              { name: "Scheduled Imports", description: "Automated recurring file imports", icon: "⏰" },
              { name: "Database Connectors", description: "Direct database connections for ERP systems", icon: "🗄️" },
              { name: "Bank Statement Formats", description: "MT940, BAI2, CAMT.053 parsers", icon: "📄" },
              { name: "Payment Gateway SDKs", description: "Native integrations with major providers", icon: "💳" },
            ].map((integration) => (
              <Card key={integration.name} variant="outlined" padding="md" className="opacity-60">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{integration.icon}</span>
                  <span className="font-medium text-white">{integration.name}</span>
                </div>
                <p className="text-sm text-gray-400">{integration.description}</p>
                <span className="mt-3 inline-block px-2 py-1 text-xs bg-amber-500/10 text-amber-400 rounded">Coming Soon</span>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}