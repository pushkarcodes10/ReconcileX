"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Table, Column } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tooltip";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badge";
import { mockUsers, dataSourceConfig } from "@/lib/mock-data";
import { UserIcon, SettingsIcon, ShieldIcon, KeyIcon, BellIcon, GlobeIcon, PlusIcon, CheckCircleIcon } from "@/components/dashboard/Icons";

const userColumns: Column<typeof mockUsers[0]>[] = [
  { key: "name", header: "Name", minWidth: "160px" },
  { key: "email", header: "Email", minWidth: "200px" },
  { key: "role", header: "Role", minWidth: "140px", render: (row) => <span className="px-2 py-1 text-xs font-medium bg-navy-700 text-gray-300 rounded">{row.role.replace("_", " ")}</span> },
  { key: "createdAt", header: "Joined", minWidth: "140px", render: (row) => <span className="text-gray-300">{new Date(row.createdAt).toLocaleDateString()}</span> },
  { key: "lastActiveAt", header: "Last Active", minWidth: "160px", render: (row) => <span className="text-gray-300">{new Date(row.lastActiveAt).toLocaleString()}</span> },
];

const roles = [
  { id: "ORG_ADMIN", name: "Organization Admin", description: "Full access to all features and settings", permissions: ["all"] },
  { id: "FINANCE_MANAGER", name: "Finance Manager", description: "Manage reconciliations, exceptions, and team", permissions: ["reconciliation", "exceptions", "reports", "imports", "data_sources"] },
  { id: "FINANCE_ANALYST", name: "Finance Analyst", description: "Investigate exceptions and view reports", permissions: ["exceptions", "reports", "transactions"] },
  { id: "AUDITOR", name: "Auditor", description: "Read-only access to audit logs and reports", permissions: ["audit_logs", "reports", "transactions"] },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("organization");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("FINANCE_ANALYST");

  const tabs = [
    { id: "organization", label: "Organization" },
    { id: "users", label: "Users" },
    { id: "roles", label: "Roles & Permissions" },
    { id: "data-sources", label: "Data Sources" },
    { id: "matching", label: "Matching Rules" },
    { id: "notifications", label: "Notifications" },
    { id: "security", label: "Security" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-gray-400">Manage your organization, team, and preferences.</p>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "organization" && (
        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Organization Name" defaultValue="Acme Corporation" />
              <Input label="Slug" defaultValue="acme-corp" />
              <Input label="Default Currency" defaultValue="INR" />
              <Select
                label="Timezone"
                value="Asia/Kolkata"
                onChange={() => {}}
                options={[
                  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
                  { value: "UTC", label: "UTC" },
                  { value: "America/New_York", label: "America/New_York (EST)" },
                  { value: "Europe/London", label: "Europe/London (GMT)" },
                ]}
              />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "users" && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold text-white">Team Members</h2>
            <Button onClick={() => setShowInviteModal(true)}>
              <PlusIcon className="mr-2" />
              Invite User
            </Button>
          </div>
          <Table
            columns={userColumns}
            data={mockUsers}
            keyExtractor={(row) => row.id}
            selectable
            emptyMessage="No users found."
          />
        </>
      )}

      {activeTab === "roles" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-white">Role Definitions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {roles.map((role) => (
              <Card key={role.id} padding="lg">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{role.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">{role.description}</p>
                  </div>
                  <span className="px-3 py-1 text-xs font-medium bg-navy-700 text-gray-300 rounded">{role.id}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {role.permissions.map((p) => (
                    <span key={p} className="px-2 py-1 text-xs bg-cyan-500/10 text-cyan-400 rounded">{p}</span>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Permission Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-navy-800/50 border-b border-navy-600">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider sticky left-0 bg-navy-800/50 z-10">Permission</th>
                      {roles.map((role) => (
                        <th key={role.id} className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">{role.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-600/50">
                    {[
                      "View Dashboard",
                      "Create Reconciliation",
                      "View Transactions",
                      "Manage Imports",
                      "View Exceptions",
                      "Resolve Exceptions",
                      "Escalate Exceptions",
                      "Generate Reports",
                      "View Audit Logs",
                      "Manage Data Sources",
                      "Configure Matching Rules",
                      "Manage Users",
                      "Organization Settings",
                    ].map((permission) => (
                      <tr key={permission} className="hover:bg-navy-700/50">
                        <td className="px-4 py-3 text-white font-medium sticky left-0 bg-navy-800 z-10">{permission}</td>
                        {roles.map((role) => (
                          <td key={role.id} className="px-4 py-3 text-center">
                            {role.permissions.includes("all") || role.permissions.some((p) => permission.toLowerCase().includes(p.toLowerCase())) ? (
                              <CheckCircleIcon className="w-5 h-5 text-green-400 mx-auto" />
                            ) : (
                              <svg className="w-5 h-5 text-gray-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "data-sources" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Data Source Configuration</CardTitle>
              <Button>
                <PlusIcon className="mr-2" />
                Add Data Source
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {Object.entries(dataSourceConfig).map(([key, config]) => (
              <div key={key} className="py-4 border-b border-navy-600 last:border-0 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", config.status === "connected" && "bg-green-500/10", config.status === "pending" && "bg-amber-500/10")}>
                    <span className="text-2xl">{config.icon}</span>
                  </div>
                  <div>
                    <p className="font-medium text-white">{config.name}</p>
                    <p className="text-sm text-gray-400">{config.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={config.status === "connected" ? "COMPLETED" : config.status === "pending" ? "QUEUED" : "FAILED"} size="sm" />
                  <Button variant="ghost" size="sm">Configure</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === "matching" && (
        <Card>
          <CardHeader>
            <CardTitle>Matching Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 mb-6">Configure deterministic matching rules for automatic transaction reconciliation.</p>
            <div className="space-y-4">
              {[
                { id: "rule-1", name: "Exact Reference Match", description: "Match transactions with identical reference and amount", enabled: true, priority: 1 },
                { id: "rule-2", name: "Amount + Date Window", description: "Match transactions with same amount within 2-day window", enabled: true, priority: 2 },
                { id: "rule-3", name: "Multi-Attribute Fuzzy", description: "Match on amount, date proximity, and reference similarity", enabled: false, priority: 3 },
              ].map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-4 rounded-xl bg-navy-800/50 border border-navy-600">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      defaultChecked={rule.enabled}
                      className="w-4 h-4 rounded border-navy-500 text-cyan-500 focus:ring-cyan-500"
                    />
                    <div>
                      <p className="font-medium text-white">{rule.name}</p>
                      <p className="text-sm text-gray-400">{rule.description}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium bg-navy-700 text-gray-300 rounded">Priority {rule.priority}</span>
                </div>
              ))}
            </div>
            <Button className="mt-6">Add Rule</Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "notifications" && (
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-400">Configure how you receive notifications for important events.</p>
            <div className="space-y-4">
              {[
                { label: "Reconciliation Completed", description: "When a reconciliation run finishes", channels: ["Email", "In-App"] },
                { label: "Exception Assigned", description: "When an exception is assigned to you", channels: ["Email", "In-App", "Slack"] },
                { label: "Import Validation Failed", description: "When an import has validation errors", channels: ["In-App"] },
                { label: "Exceptions Require Attention", description: "Daily summary of open exceptions", channels: ["Email", "In-App"] },
                { label: "Job Failed", description: "When a background job fails", channels: ["In-App", "Slack"] },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-4 rounded-xl bg-navy-800/50 border border-navy-600">
                  <div>
                    <p className="font-medium text-white">{item.label}</p>
                    <p className="text-sm text-gray-400">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.channels.map((c) => (
                      <span key={c} className="px-2 py-1 text-xs bg-cyan-500/10 text-cyan-400 rounded">{c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "security" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Two-Factor Authentication</h3>
                <div className="flex items-center justify-between p-4 rounded-xl bg-navy-800/50 border border-navy-600">
                  <div>
                    <p className="font-medium text-white">Require 2FA for all users</p>
                    <p className="text-sm text-gray-400">Enforce two-factor authentication for organization members</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-navy-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>
              </div>
              <div className="pt-6 border-t border-navy-600">
                <h3 className="text-lg font-semibold text-white mb-4">Session Management</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Session Timeout (minutes)" type="number" defaultValue="480" />
                  <Input label="Max Concurrent Sessions" type="number" defaultValue="5" />
                </div>
              </div>
              <div className="pt-6 border-t border-navy-600">
                <h3 className="text-lg font-semibold text-white mb-4">Password Policy</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Min Length" type="number" defaultValue="12" />
                  <Input label="Require Special Characters" type="checkbox" />
                  <Input label="Prevent Reuse (generations)" type="number" defaultValue="5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 mb-4">Manage API keys for programmatic access.</p>
              <Button>
                <PlusIcon className="mr-2" />
                Generate New Key
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}