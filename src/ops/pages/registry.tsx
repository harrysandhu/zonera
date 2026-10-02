import type React from "react";
import OverviewPage from "./OverviewPage";
import FacilityPage from "./FacilityPage";
import UnitsPage from "./UnitsPage";
import TenantsPage from "./TenantsPage";
import LeasesPage from "./LeasesPage";
import PaymentsPage from "./PaymentsPage";
import DelinquencyPage from "./DelinquencyPage";
import LeadsPage from "./LeadsPage";
import RatesPage from "./RatesPage";
import GatePage from "./GatePage";
import MaintenancePage from "./MaintenancePage";
import ReportsPage from "./ReportsPage";
import SettingsPage from "./SettingsPage";
import { AgentWorkspace } from "../../agent/AgentWorkspace";
import { CallCenterPage } from "../../calls/CallCenterPage";

// Route segment after "ops/" → page. Pages receive the optional id segment
// (e.g. ops/tenants/T-1000 → TenantsPage id="T-1000", which renders the profile).
export const PAGES: Record<string, React.ComponentType<{ id?: string }>> = {
  overview: OverviewPage,
  facility: FacilityPage,
  units: UnitsPage,
  tenants: TenantsPage,
  leases: LeasesPage,
  payments: PaymentsPage,
  delinquency: DelinquencyPage,
  leads: LeadsPage,
  rates: RatesPage,
  gate: GatePage,
  maintenance: MaintenancePage,
  reports: ReportsPage,
  settings: SettingsPage,
  agent: AgentWorkspace,
  calls: CallCenterPage,
};
