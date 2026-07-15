import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
import AdminSettings from "./pages/AdminSettings";
import Auth from "./pages/Auth";
import AdminWeeklyMenus from "./pages/AdminWeeklyMenus";
import Consultation from "./pages/Consultation";
import NotFound from "./pages/NotFound";
import PatientDashboard from "./pages/patient/PatientDashboard";
import MyPlan from "./pages/patient/MyPlan";
import PatientProgress from "./pages/patient/PatientProgress";
import PatientAppointments from "./pages/patient/PatientAppointments";
import PatientMessages from "./pages/patient/PatientMessages";
import PatientMeals from "./pages/patient/PatientMeals";
import PatientProfile from "./pages/patient/PatientProfile";
import PatientSettings from "./pages/patient/PatientSettings";
import PatientRecipes from "./pages/patient/PatientRecipes";
import PatientHelp from "./pages/patient/PatientHelp";
import AdminSupport from "./pages/AdminSupport";
import SuperadminDashboard from "./pages/superadmin/SuperadminDashboard";
import SuperadminUsers from "./pages/superadmin/SuperadminUsers";
import SuperadminNutritionists from "./pages/superadmin/SuperadminNutritionists";
import SuperadminOrganizations from "./pages/superadmin/SuperadminOrganizations";
import SuperadminBilling from "./pages/superadmin/SuperadminBilling";
import SuperadminSettings from "./pages/superadmin/SuperadminSettings";
import SuperadminRecipes from "./pages/superadmin/SuperadminRecipes";
import SuperadminArticles from "./pages/superadmin/SuperadminArticles";
import SuperadminArticleEditor from "./pages/superadmin/SuperadminArticleEditor";
import ResetPassword from "./pages/ResetPassword";
import RegisterNutritionist from "./pages/RegisterNutritionist";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
              
              {/* Auth */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/register-nutritionist" element={<RegisterNutritionist />} />

              {/* Admin Routes */}
              <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><Index /></ProtectedRoute>} />
              <Route path="/patients" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><Patients /></ProtectedRoute>} />
              <Route path="/meal-plans" element={<ProtectedRoute allowedRoles={['admin']}><MealPlans /></ProtectedRoute>} />
              <Route path="/appointments" element={<ProtectedRoute allowedRoles={['admin']}><AdminCalendar /></ProtectedRoute>} />
              <Route path="/consultation" element={<ProtectedRoute allowedRoles={['admin']}><Consultation /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute allowedRoles={['admin']}><AdminMessages /></ProtectedRoute>} />
              <Route path="/recipes" element={<ProtectedRoute allowedRoles={['admin']}><AdminRecipes /></ProtectedRoute>} />
              <Route path="/composition-table" element={<ProtectedRoute allowedRoles={['admin']}><AdminCompositionTable /></ProtectedRoute>} />
              <Route path="/progress" element={<ProtectedRoute allowedRoles={['admin']}><AdminProgress /></ProtectedRoute>} />
              <Route path="/weekly-menus" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><AdminWeeklyMenus /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin']}><AdminSettings /></ProtectedRoute>} />
              <Route path="/support" element={<ProtectedRoute allowedRoles={['admin']}><AdminSupport /></ProtectedRoute>} />

              {/* Patient Routes */}
              <Route path="/patient" element={<ProtectedRoute allowedRoles={['patient']}><PatientDashboard /></ProtectedRoute>} />
              <Route path="/patient/my-plan" element={<ProtectedRoute allowedRoles={['patient']}><MyPlan /></ProtectedRoute>} />
              <Route path="/patient/progress" element={<ProtectedRoute allowedRoles={['patient']}><PatientProgress /></ProtectedRoute>} />
              <Route path="/patient/appointments" element={<ProtectedRoute allowedRoles={['patient']}><PatientAppointments /></ProtectedRoute>} />
              <Route path="/patient/messages" element={<ProtectedRoute allowedRoles={['patient']}><PatientMessages /></ProtectedRoute>} />
              <Route path="/patient/profile" element={<ProtectedRoute allowedRoles={['patient']}><PatientProfile /></ProtectedRoute>} />
              <Route path="/patient/settings" element={<ProtectedRoute allowedRoles={['patient']}><PatientSettings /></ProtectedRoute>} />
              <Route path="/patient/recipes" element={<ProtectedRoute allowedRoles={['patient']}><PatientRecipes /></ProtectedRoute>} />
              <Route path="/patient/help" element={<ProtectedRoute allowedRoles={['patient']}><PatientHelp /></ProtectedRoute>} />

              {/* SuperAdmin Routes */}
              <Route path="/superadmin" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminDashboard /></ProtectedRoute>} />
              <Route path="/superadmin/users" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminUsers /></ProtectedRoute>} />
              <Route path="/superadmin/nutritionists" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminNutritionists /></ProtectedRoute>} />
              <Route path="/superadmin/recipes" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminRecipes /></ProtectedRoute>} />
              <Route path="/superadmin/articles" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminArticles /></ProtectedRoute>} />
              <Route path="/superadmin/articles/new" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminArticleEditor /></ProtectedRoute>} />
              <Route path="/superadmin/articles/:id/edit" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminArticleEditor /></ProtectedRoute>} />
              <Route path="/superadmin/organizations" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminOrganizations /></ProtectedRoute>} />
              <Route path="/superadmin/billing" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminBilling /></ProtectedRoute>} />
              <Route path="/superadmin/settings" element={<ProtectedRoute allowedRoles={['superadmin']}><SuperadminSettings /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
              </Routes>
            </ClickSpark>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
