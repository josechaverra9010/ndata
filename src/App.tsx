import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { I18nProvider } from "@/lib/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import ClickSpark from "@/components/ClickSpark";
import Home from "./pages/Home";
import ArticleDetail from "./pages/ArticleDetail";
import Articles from "./pages/Articles";
import Index from "./pages/Index";
import Patients from "./pages/Patients";
import MealPlans from "./pages/MealPlans";
import AdminCalendar from "./pages/AdminCalendar";
import AdminMessages from "./pages/AdminMessages";
import AdminRecipes from "./pages/AdminRecipes";
import AdminCompositionTable from "./pages/AdminCompositionTable";
import AdminProgress from "./pages/AdminProgress";
import AdminAdherenceAnalytics from "./pages/AdminAdherenceAnalytics";
import AdminClinicalColombia from "./pages/AdminClinicalColombia";
import AdminInterventions from "./pages/AdminInterventions";
import AdminClinicalHub from "./pages/AdminClinicalHub";
import AdminSettings from "./pages/AdminSettings";
import Auth from "./pages/Auth";
import AdminWeeklyMenus from "./pages/AdminWeeklyMenus";
import Consultation from "./pages/Consultation";
import WorkQueue from "./pages/WorkQueue";
import NotFound from "./pages/NotFound";
import PatientDashboard from "./pages/patient/PatientDashboard";
import MyPlan from "./pages/patient/MyPlan";
import PatientProgress from "./pages/patient/PatientProgress";
import PatientAppointments from "./pages/patient/PatientAppointments";
import PatientMessages from "./pages/patient/PatientMessages";
import PatientMeals from "./pages/patient/PatientMeals";
import PatientFoodDiary from "./pages/patient/PatientFoodDiary";
import PatientProfile from "./pages/patient/PatientProfile";
import PatientSettings from "./pages/patient/PatientSettings";
import PatientRecipes from "./pages/patient/PatientRecipes";
import PatientHelp from "./pages/patient/PatientHelp";
import PatientAdherence from "./pages/patient/PatientAdherence";
import PatientNotifications from "./pages/patient/PatientNotifications";
import PatientProgram from "./pages/patient/PatientProgram";
import PatientBilling from "./pages/patient/PatientBilling";
import AdminSupport from "./pages/AdminSupport";
import AdminBilling from "./pages/admin/AdminBilling";
import SuperadminDashboard from "./pages/superadmin/SuperadminDashboard";
import SuperadminUsers from "./pages/superadmin/SuperadminUsers";
import SuperadminNutritionists from "./pages/superadmin/SuperadminNutritionists";
import SuperadminOrganizations from "./pages/superadmin/SuperadminOrganizations";
import EpsDashboard from "./pages/org/EpsDashboard";
import SuperadminBilling from "./pages/superadmin/SuperadminBilling";
import SuperadminTenantHealth from "./pages/superadmin/SuperadminTenantHealth";
import SuperadminAuditLog from "./pages/superadmin/SuperadminAuditLog";
import SuperadminSettings from "./pages/superadmin/SuperadminSettings";
import SuperadminFeatures from "./pages/superadmin/SuperadminFeatures";
import SuperadminOps from "./pages/superadmin/SuperadminOps";
import SuperadminCompliance from "./pages/superadmin/SuperadminCompliance";
import SuperadminIntegrations from "./pages/superadmin/SuperadminIntegrations";
import SuperadminSupport from "./pages/superadmin/SuperadminSupport";
import SuperadminAnalytics from "./pages/superadmin/SuperadminAnalytics";
import SuperadminClinicalContent from "./pages/superadmin/SuperadminClinicalContent";
import SuperadminPlatform from "./pages/superadmin/SuperadminPlatform";
import { ReleaseNotesPrompt } from "@/components/ReleaseNotesPrompt";
import { AosProvider } from "@/components/AosProvider";
import SuperadminRecipes from "./pages/superadmin/SuperadminRecipes";
import SuperadminArticles from "./pages/superadmin/SuperadminArticles";
import SuperadminArticleEditor from "./pages/superadmin/SuperadminArticleEditor";
import ResetPassword from "./pages/ResetPassword";
import RegisterNutritionist from "./pages/RegisterNutritionist";
import RegisterPatient from "./pages/RegisterPatient";
import LegalDocumentPage from "./pages/LegalDocumentPage";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AosProvider />
            <ReleaseNotesPrompt />
            <MaintenanceGate>
            <ClickSpark
              sparkColor="#fff"
              sparkSize={5}
              sparkRadius={200}
              sparkCount={8}
              duration={400}
            >
              <Routes>
              {/* Public Home */}
              <Route path="/" element={<Home />} />
              <Route path="/articles" element={<Articles />} />
              <Route path="/article/:id" element={<ArticleDetail />} />
              <Route path="/privacidad" element={<LegalDocumentPage docType="privacy_policy" />} />
              <Route path="/terminos" element={<LegalDocumentPage docType="terms" />} />
              <Route path="/cookies" element={<LegalDocumentPage docType="cookies_policy" />} />
              
              {/* Auth */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/register" element={<RegisterPatient />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/register-nutritionist" element={<RegisterNutritionist />} />

              {/* Admin Routes */}
              <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><Index /></ProtectedRoute>} />
              <Route path="/eps" element={<ProtectedRoute allowedRoles={['admin']}><EpsDashboard /></ProtectedRoute>} />
              <Route path="/patients" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><Patients /></ProtectedRoute>} />
              <Route path="/meal-plans" element={<ProtectedRoute allowedRoles={['admin']}><MealPlans /></ProtectedRoute>} />
              <Route path="/appointments" element={<ProtectedRoute allowedRoles={['admin']}><AdminCalendar /></ProtectedRoute>} />
              <Route path="/consultation" element={<ProtectedRoute allowedRoles={['admin']}><Consultation /></ProtectedRoute>} />
              <Route path="/work-queue" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><WorkQueue /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute allowedRoles={['admin']}><AdminMessages /></ProtectedRoute>} />
              <Route path="/recipes" element={<ProtectedRoute allowedRoles={['admin']}><AdminRecipes /></ProtectedRoute>} />
              <Route path="/composition-table" element={<ProtectedRoute allowedRoles={['admin']}><AdminCompositionTable /></ProtectedRoute>} />
              <Route path="/progress" element={<ProtectedRoute allowedRoles={['admin']}><AdminProgress /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><AdminAdherenceAnalytics /></ProtectedRoute>} />
              <Route path="/clinical" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><AdminClinicalColombia /></ProtectedRoute>} />
              <Route path="/interventions" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><AdminInterventions /></ProtectedRoute>} />
              <Route path="/clinical-hub" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><AdminClinicalHub /></ProtectedRoute>} />
              <Route path="/weekly-menus" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><AdminWeeklyMenus /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin']}><AdminSettings /></ProtectedRoute>} />
              <Route path="/billing" element={<ProtectedRoute allowedRoles={['admin']}><AdminBilling /></ProtectedRoute>} />
              <Route path="/support" element={<ProtectedRoute allowedRoles={['admin']}><AdminSupport /></ProtectedRoute>} />

              {/* Patient Routes */}
              <Route path="/patient" element={<ProtectedRoute allowedRoles={['patient']}><PatientDashboard /></ProtectedRoute>} />
              <Route path="/patient/dashboard" element={<Navigate to="/patient" replace />} />
              <Route path="/patient/meals" element={<ProtectedRoute allowedRoles={['patient']}><PatientMeals /></ProtectedRoute>} />
              <Route path="/patient/my-plan" element={<ProtectedRoute allowedRoles={['patient']}><MyPlan /></ProtectedRoute>} />
              <Route path="/patient/adherence" element={<ProtectedRoute allowedRoles={['patient']}><PatientAdherence /></ProtectedRoute>} />
              <Route path="/patient/notifications" element={<ProtectedRoute allowedRoles={['patient']}><PatientNotifications /></ProtectedRoute>} />
              <Route path="/patient/recommendations" element={<Navigate to="/patient" replace />} />
              <Route path="/patient/shopping-list" element={<Navigate to="/patient" replace />} />
              <Route path="/patient/documents" element={<Navigate to="/patient" replace />} />
              <Route path="/patient/challenges" element={<Navigate to="/patient" replace />} />
              <Route path="/patient/learn" element={<Navigate to="/patient" replace />} />
              <Route path="/patient/program" element={<ProtectedRoute allowedRoles={['patient']}><PatientProgram /></ProtectedRoute>} />
              <Route path="/patient/habits" element={<Navigate to="/patient" replace />} />
              <Route path="/patient/food-diary" element={<ProtectedRoute allowedRoles={['patient']}><PatientFoodDiary /></ProtectedRoute>} />
              <Route path="/patient/substitutions" element={<Navigate to="/patient" replace />} />
              <Route path="/patient/progress" element={<ProtectedRoute allowedRoles={['patient']}><PatientProgress /></ProtectedRoute>} />
              <Route path="/patient/appointments" element={<ProtectedRoute allowedRoles={['patient']}><PatientAppointments /></ProtectedRoute>} />
              <Route path="/patient/messages" element={<ProtectedRoute allowedRoles={['patient']}><PatientMessages /></ProtectedRoute>} />
              <Route path="/patient/profile" element={<ProtectedRoute allowedRoles={['patient']}><PatientProfile /></ProtectedRoute>} />
              <Route path="/patient/settings" element={<ProtectedRoute allowedRoles={['patient']}><PatientSettings /></ProtectedRoute>} />
              <Route path="/patient/recipes" element={<ProtectedRoute allowedRoles={['patient']}><PatientRecipes /></ProtectedRoute>} />
              <Route path="/patient/help" element={<ProtectedRoute allowedRoles={['patient']}><PatientHelp /></ProtectedRoute>} />
              <Route path="/patient/billing" element={<ProtectedRoute allowedRoles={['patient']}><PatientBilling /></ProtectedRoute>} />

              {/* SuperAdmin Routes */}
              <Route path="/superadmin" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminDashboard /></ProtectedRoute>} />
              <Route path="/superadmin/users" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminUsers /></ProtectedRoute>} />
              <Route path="/superadmin/nutritionists" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminNutritionists /></ProtectedRoute>} />
              <Route path="/superadmin/recipes" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminRecipes /></ProtectedRoute>} />
              <Route path="/superadmin/articles" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminArticles /></ProtectedRoute>} />
              <Route path="/superadmin/articles/new" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminArticleEditor /></ProtectedRoute>} />
              <Route path="/superadmin/articles/:id/edit" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminArticleEditor /></ProtectedRoute>} />
              <Route path="/superadmin/organizations" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminOrganizations /></ProtectedRoute>} />
              <Route path="/superadmin/tenant-health" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminTenantHealth /></ProtectedRoute>} />
              <Route path="/superadmin/audit" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminAuditLog /></ProtectedRoute>} />
              <Route path="/superadmin/billing" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminBilling /></ProtectedRoute>} />
              <Route path="/superadmin/features" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminFeatures /></ProtectedRoute>} />
              <Route path="/superadmin/ops" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminOps /></ProtectedRoute>} />
              <Route path="/superadmin/compliance" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminCompliance /></ProtectedRoute>} />
              <Route path="/superadmin/integrations" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminIntegrations /></ProtectedRoute>} />
              <Route path="/superadmin/support" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminSupport /></ProtectedRoute>} />
              <Route path="/superadmin/analytics" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminAnalytics /></ProtectedRoute>} />
              <Route path="/superadmin/clinical-content" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminClinicalContent /></ProtectedRoute>} />
              <Route path="/superadmin/platform" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminPlatform /></ProtectedRoute>} />
              <Route path="/superadmin/settings" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminSettings /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
              </Routes>
            </ClickSpark>
            </MaintenanceGate>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
