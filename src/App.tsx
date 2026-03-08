import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { BranchProvider } from "@/contexts/BranchContext";
import { OfflineSyncProvider } from "@/contexts/OfflineSyncContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";
import InventoryPage from "./pages/InventoryPage";
import POSPage from "./pages/POSPage";
import ProductsPage from "./pages/ProductsPage";
import ProductForm from "./pages/ProductForm";
import QuotationsPage from "./pages/QuotationsPage";
import QuotationForm from "./pages/QuotationForm";
import DeliveryNotesPage from "./pages/DeliveryNotesPage";
import DeliveryNoteForm from "./pages/DeliveryNoteForm";
import InvoicesPage from "./pages/InvoicesPage";
import InvoiceForm from "./pages/InvoiceForm";
import InvoiceDetail from "./pages/InvoiceDetail";
import CustomersPage from "./pages/CustomersPage";
import CustomerForm from "./pages/CustomerForm";
import CustomerDetail from "./pages/CustomerDetail";
import PaymentsPage from "./pages/PaymentsPage";
import ReportsPage from "./pages/ReportsPage";
import BranchesPage from "./pages/BranchesPage";
import UserManagementPage from "./pages/UserManagementPage";
import BranchStockComparisonPage from "./pages/BranchStockComparisonPage";
import ReorderSuggestionsPage from "./pages/ReorderSuggestionsPage";
import SuppliersPage from "./pages/SuppliersPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import PurchaseOrderForm from "./pages/PurchaseOrderForm";
import ReceiptsPage from "./pages/ReceiptsPage";
import ReceiptForm from "./pages/ReceiptForm";
import CompanySettingsPage from "./pages/CompanySettingsPage";
import AdminDashboard from "./pages/AdminDashboard";
import InstallPage from "./pages/InstallPage";
import ActivityLogsPage from "./pages/ActivityLogsPage";
import DiscountCodesPage from "./pages/DiscountCodesPage";
import TimeTrackingPage from "./pages/TimeTrackingPage";
import CustomFieldsPage from "./pages/CustomFieldsPage";
 import PayrollReportsPage from "./pages/PayrollReportsPage";
 import ProfilePage from "./pages/ProfilePage";
import DocumentTemplatesPage from "./pages/DocumentTemplatesPage";
import ExpensesPage from "./pages/ExpensesPage";
import ApprovalThresholdsPage from "./pages/ApprovalThresholdsPage";
import BranchReportsPage from "./pages/BranchReportsPage";
import BranchGradesPage from "./pages/BranchGradesPage";
import AuditVisitsPage from "./pages/AuditVisitsPage";
import FinancialStatementsPage from "./pages/FinancialStatementsPage";
import AgingReportsPage from "./pages/AgingReportsPage";
import CreditNotesPage from "./pages/CreditNotesPage";
import RecurringInvoicesPage from "./pages/RecurringInvoicesPage";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BranchProvider>
        <OfflineSyncProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/pos" element={<ProtectedRoute><POSPage /></ProtectedRoute>} />
                <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
                <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
                <Route path="/products/new" element={<ProtectedRoute><ProductForm /></ProtectedRoute>} />
                <Route path="/products/:id/edit" element={<ProtectedRoute><ProductForm /></ProtectedRoute>} />
                <Route path="/invoices" element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />
                <Route path="/invoices/new" element={<ProtectedRoute><InvoiceForm /></ProtectedRoute>} />
                <Route path="/invoices/:id/edit" element={<ProtectedRoute><InvoiceForm /></ProtectedRoute>} />
                <Route path="/invoices/:id" element={<ProtectedRoute><InvoiceDetail /></ProtectedRoute>} />
                <Route path="/quotations" element={<ProtectedRoute><QuotationsPage /></ProtectedRoute>} />
                <Route path="/quotations/new" element={<ProtectedRoute><QuotationForm /></ProtectedRoute>} />
                <Route path="/quotations/:id" element={<ProtectedRoute><QuotationForm /></ProtectedRoute>} />
                <Route path="/quotations/:id/edit" element={<ProtectedRoute><QuotationForm /></ProtectedRoute>} />
                <Route path="/delivery-notes" element={<ProtectedRoute><DeliveryNotesPage /></ProtectedRoute>} />
                <Route path="/delivery-notes/new" element={<ProtectedRoute><DeliveryNoteForm /></ProtectedRoute>} />
                <Route path="/delivery-notes/:id" element={<ProtectedRoute><DeliveryNoteForm /></ProtectedRoute>} />
                <Route path="/delivery-notes/:id/edit" element={<ProtectedRoute><DeliveryNoteForm /></ProtectedRoute>} />
                <Route path="/receipts" element={<ProtectedRoute><ReceiptsPage /></ProtectedRoute>} />
                <Route path="/receipts/new" element={<ProtectedRoute><ReceiptForm /></ProtectedRoute>} />
                <Route path="/receipts/:id" element={<ProtectedRoute><ReceiptForm /></ProtectedRoute>} />
                <Route path="/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
                <Route path="/customers/new" element={<ProtectedRoute><CustomerForm /></ProtectedRoute>} />
                <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetail /></ProtectedRoute>} />
                <Route path="/customers/:id/edit" element={<ProtectedRoute><CustomerForm /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
                <Route path="/branches" element={<ProtectedRoute><BranchesPage /></ProtectedRoute>} />
                <Route path="/branch-stock" element={<ProtectedRoute><BranchStockComparisonPage /></ProtectedRoute>} />
                <Route path="/reorder" element={<ProtectedRoute><ReorderSuggestionsPage /></ProtectedRoute>} />
                <Route path="/suppliers" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />
                <Route path="/purchase-orders" element={<ProtectedRoute><PurchaseOrdersPage /></ProtectedRoute>} />
                <Route path="/purchase-orders/new" element={<ProtectedRoute><PurchaseOrderForm /></ProtectedRoute>} />
                <Route path="/purchase-orders/:id" element={<ProtectedRoute><PurchaseOrderForm /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute><UserManagementPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><CompanySettingsPage /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
                <Route path="/install" element={<ProtectedRoute><InstallPage /></ProtectedRoute>} />
               <Route path="/time-tracking" element={<ProtectedRoute><TimeTrackingPage /></ProtectedRoute>} />
               <Route path="/discounts" element={<ProtectedRoute><DiscountCodesPage /></ProtectedRoute>} />
               <Route path="/activity-logs" element={<ProtectedRoute><ActivityLogsPage /></ProtectedRoute>} />
               <Route path="/custom-fields" element={<ProtectedRoute><CustomFieldsPage /></ProtectedRoute>} />
               <Route path="/payroll-reports" element={<ProtectedRoute><PayrollReportsPage /></ProtectedRoute>} />
               <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
               <Route path="/document-templates" element={<ProtectedRoute><DocumentTemplatesPage /></ProtectedRoute>} />
               <Route path="/expenses" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
               <Route path="/approval-thresholds" element={<ProtectedRoute><ApprovalThresholdsPage /></ProtectedRoute>} />
               <Route path="/branch-reports" element={<ProtectedRoute><BranchReportsPage /></ProtectedRoute>} />
               <Route path="/branch-grades" element={<ProtectedRoute><BranchGradesPage /></ProtectedRoute>} />
               <Route path="/audit-visits" element={<ProtectedRoute><AuditVisitsPage /></ProtectedRoute>} />
               <Route path="/financial-statements" element={<ProtectedRoute><FinancialStatementsPage /></ProtectedRoute>} />
               <Route path="/aging-reports" element={<ProtectedRoute><AgingReportsPage /></ProtectedRoute>} />
               <Route path="/credit-notes" element={<ProtectedRoute><CreditNotesPage /></ProtectedRoute>} />
               <Route path="/recurring-invoices" element={<ProtectedRoute><RecurringInvoicesPage /></ProtectedRoute>} />
               <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </OfflineSyncProvider>
      </BranchProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
