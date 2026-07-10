import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Plus, 
  Trash2, 
  Calendar, 
  FileText, 
  UserPlus, 
  DollarSign, 
  Image, 
  Printer, 
  X, 
  PlusCircle, 
  MinusCircle, 
  Key, 
  UserCheck 
} from 'lucide-react';
import { db, formatPrice, type Employee } from '../db/database';
import { jsPDF } from 'jspdf';
import { useTableSort, renderSortIcon } from '../hooks/useTableSort';

interface OfficeScreenProps {
  userRole: 'OWNER' | 'ADMIN' | 'EMPLOYEE';
}

export default function OfficeScreen({ userRole }: OfficeScreenProps) {
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const employees = useLiveQuery(() => db.employees.toArray()) || [];
  const salaries = useLiveQuery(() => db.salaries.toArray()) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const usersList = useLiveQuery(() => db.users.toArray()) || [];

  const isAdminOrOwner = userRole === 'OWNER' || userRole === 'ADMIN';

  // Tab state: 0 = Expenses, 1 = Employees, 2 = Salaries, 3 = Suppliers, 4 = User Accounts
  const [officeTab, setOfficeTab] = useState(() => {
    return userRole === 'EMPLOYEE' ? 3 : 0;
  });

  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  
  // Active User Account Actions
  const [resetPasswordEmail, setResetPasswordEmail] = useState('');
  const [newPasswordVal, setNewPasswordVal] = useState('');

  // Printable Payslip state
  const [printablePayslip, setPrintablePayslip] = useState<{
    employeeName: string;
    salaryRate: number;
    amount: number;
    bonus: number;
    deduction: number;
    advance: number;
    netPay: number;
    dateStr: string;
    remarks: string;
  } | null>(null);

  // Form states: Expense
  const [expCategory, setExpCategory] = useState('Misc');
  const [expAmount, setExpAmount] = useState(0);
  const [expDesc, setExpDesc] = useState('');
  const [expImage, setExpImage] = useState<string>('');

  // Form states: Employee
  const [empName, setEmpName] = useState('');
  const [empRate, setEmpRate] = useState(0);

  // Form states: Salary Payout
  const [salEmployeeId, setSalEmployeeId] = useState<number | ''>('');
  const [salAmount, setSalAmount] = useState(0);
  const [salBonus, setSalBonus] = useState(0);
  const [salDeduction, setSalDeduction] = useState(0);
  const [salAdvance, setSalAdvance] = useState(0);
  const [salRemarks, setSalRemarks] = useState('');

  // Form states: Supplier Master
  const [supName, setSupName] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supContacts, setSupContacts] = useState<{ name: string; phone: string }[]>([
    { name: '', phone: '' }
  ]);

  // Form states: Create User
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'ADMIN' | 'EMPLOYEE'>('EMPLOYEE');

  // Helper Employee name map
  const employeeMap = useMemo(() => {
    const map: { [key: number]: Employee } = {};
    employees.forEach(emp => {
      if (emp.id) map[emp.id] = emp;
    });
    return map;
  }, [employees]);

  // 1. Sorting logic for Expenses (Tab 0)
  const { sortedData: sortedExpenses, requestSort: requestSortExp, sortConfig: sortConfigExp } = useTableSort(expenses, {
    key: 'date',
    direction: 'desc'
  });

  // 2. Sorting logic for Employees (Tab 1)
  const { sortedData: sortedEmployees, requestSort: requestSortEmp, sortConfig: sortConfigEmp } = useTableSort(employees, {
    key: 'name',
    direction: 'asc'
  });

  // 3. Sorting logic for Salaries (Tab 2)
  const salariesWithData = useMemo(() => {
    return salaries.map(s => {
      const emp = employeeMap[s.employeeId];
      return {
        ...s,
        employeeName: emp?.name || 'Deleted Employee',
        netPay: s.amount + s.bonus - s.deduction - s.advance
      };
    });
  }, [salaries, employeeMap]);
  const { sortedData: sortedSalaries, requestSort: requestSortSal, sortConfig: sortConfigSal } = useTableSort(salariesWithData, {
    key: 'date',
    direction: 'desc'
  });

  // 4. Sorting logic for Suppliers (Tab 3)
  const suppliersWithData = useMemo(() => {
    return suppliers.map(s => ({
      ...s,
      firstContactName: s.contacts?.[0]?.name || '',
      firstContactPhone: s.contacts?.[0]?.phone || ''
    }));
  }, [suppliers]);
  const { sortedData: sortedSuppliers, requestSort: requestSortSup, sortConfig: sortConfigSup } = useTableSort(suppliersWithData, {
    key: 'name',
    direction: 'asc'
  });

  // 5. Sorting logic for Users (Tab 4)
  const { sortedData: sortedUsers, requestSort: requestSortUser, sortConfig: sortConfigUser } = useTableSort(usersList, {
    key: 'name',
    direction: 'asc'
  });

  // Handle Receipt Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setExpImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    try {
      await db.expenses.add({
        category: expCategory,
        amount: expAmount,
        description: expDesc.trim(),
        date: Date.now(),
        billImagePath: expImage || undefined,
      });
      setIsExpenseModalOpen(false);
      setExpCategory('Misc');
      setExpAmount(0);
      setExpDesc('');
      setExpImage('');
    } catch (err) {
      console.error(err);
      alert('Failed to log expense.');
    }
  };

  // Submit Employee
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName || empRate <= 0) {
      alert('Please fill out all employee fields.');
      return;
    }

    try {
      await db.employees.add({
        name: empName,
        salaryRate: empRate,
        status: 'Active',
      });
      setIsEmployeeModalOpen(false);
      setEmpName('');
      setEmpRate(0);
    } catch (err) {
      console.error(err);
      alert('Failed to create employee profile.');
    }
  };

  // Pay Employee Salary
  const handlePaySalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salEmployeeId || salAmount <= 0) {
      alert('Select an employee and set payout amount.');
      return;
    }

    try {
      const dateVal = Date.now();
      const emp = employeeMap[Number(salEmployeeId)];
      const bonus = salBonus || 0;
      const deduction = salDeduction || 0;
      const advance = salAdvance || 0;
      const netPay = salAmount + bonus - deduction - advance;

      await db.salaries.add({
        employeeId: Number(salEmployeeId),
        amount: salAmount,
        bonus,
        deduction,
        advance,
        date: dateVal,
        remarks: salRemarks,
      });

      await db.expenses.add({
        category: 'Salary',
        amount: netPay,
        description: `Salary payout to employee ${emp?.name || 'ID: ' + salEmployeeId}. Bonus: Rs.${bonus}, Ded: Rs.${deduction}, Adv: Rs.${advance}`,
        date: dateVal
      });

      setIsSalaryModalOpen(false);
      
      setPrintablePayslip({
        employeeName: emp?.name || 'Unknown',
        salaryRate: emp?.salaryRate || 0,
        amount: salAmount,
        bonus,
        deduction,
        advance,
        netPay,
        dateStr: new Date(dateVal).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        remarks: salRemarks,
      });

      setSalEmployeeId('');
      setSalAmount(0);
      setSalBonus(0);
      setSalDeduction(0);
      setSalAdvance(0);
      setSalRemarks('');
    } catch (err) {
      console.error(err);
      alert('Failed to log salary payment.');
    }
  };

  const handleSelectEmployeeForSalary = (empId: number | '') => {
    setSalEmployeeId(empId);
    if (empId !== '') {
      const emp = employeeMap[empId];
      if (emp) {
        setSalAmount(emp.salaryRate);
      }
    }
  };

  // Submit Supplier Master (Coupled Contact & Phone)
  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) {
      alert('Supplier Name is required.');
      return;
    }

    const validContacts = supContacts.filter(c => c.name.trim() !== '');
    for (const c of validContacts) {
      if (!c.phone.trim()) {
        alert(`Please enter a contact number for ${c.name}`);
        return;
      }
    }

    try {
      await db.suppliers.add({
        name: supName.trim(),
        contacts: validContacts.map(c => ({ name: c.name.trim(), phone: c.phone.trim() })),
        address: supAddress.trim(),
      });
      setIsSupplierModalOpen(false);
      setSupName('');
      setSupAddress('');
      setSupContacts([{ name: '', phone: '' }]);
    } catch (err) {
      console.error(err);
      alert('Failed to save supplier. Name might already be registered.');
    }
  };

  // User accounts management handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserName.trim() || !newUserPassword.trim()) {
      alert('Please fill out all user profile fields.');
      return;
    }

    try {
      const userExists = await db.users.get(newUserEmail.trim().toLowerCase());
      if (userExists) {
        alert('A user account with this email is already registered.');
        return;
      }

      await db.users.put({
        id: newUserEmail.trim().toLowerCase(),
        email: newUserEmail.trim().toLowerCase(),
        name: newUserName.trim(),
        role: newUserRole,
        password: newUserPassword
      });

      setIsUserModalOpen(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      setNewUserRole('EMPLOYEE');
    } catch (err) {
      console.error(err);
      alert('Failed to save user account.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasswordVal.trim()) {
      alert('Password cannot be empty.');
      return;
    }

    try {
      await db.users.update(resetPasswordEmail, { password: newPasswordVal });
      setIsResetPasswordModalOpen(false);
      setResetPasswordEmail('');
      setNewPasswordVal('');
      alert('Password updated successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to update password.');
    }
  };

  const handleDeleteUser = async (email: string) => {
    const activeEmail = localStorage.getItem('current_user_email');
    if (activeEmail && activeEmail.toLowerCase() === email.toLowerCase()) {
      alert('You cannot delete your own logged-in account.');
      return;
    }

    const targetUser = await db.users.get(email);
    if (targetUser?.role === 'OWNER') {
      alert('The Owner account cannot be deleted.');
      return;
    }

    if (confirm(`Are you sure you want to permanently delete user account: ${email}?`)) {
      await db.users.delete(email);
    }
  };

  // Delete Handlers
  const handleDeleteExpense = async (id?: number) => {
    if (!id) return;
    if (confirm('Delete this expense?')) {
      await db.expenses.delete(id);
    }
  };

  const handleDeleteEmployee = async (id?: number) => {
    if (!id) return;
    if (confirm('Remove employee profile?')) {
      await db.employees.delete(id);
    }
  };

  const handleDeleteSupplier = async (id?: number) => {
    if (!id) return;
    if (confirm('Remove supplier profile centrally?')) {
      await db.suppliers.delete(id);
    }
  };

  // Contact person/phone array edits
  const handleContactRowChange = (index: number, key: 'name' | 'phone', val: string) => {
    const next = [...supContacts];
    next[index] = { ...next[index], [key]: val };
    setSupContacts(next);
  };
  const handleAddContactRow = () => setSupContacts([...supContacts, { name: '', phone: '' }]);
  const handleRemoveContactRow = (idx: number) => setSupContacts(supContacts.filter((_, i) => i !== idx));

  // PDF Download
  const handleDownloadPayslipPDF = (payslip: typeof printablePayslip) => {
    if (!payslip) return;
    const doc = new jsPDF();
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(22);
    doc.text('DUKANDAR RETAIL BUSINESS', 20, 20);
    doc.setFontSize(14);
    doc.text('Official Employee Salary Payslip', 20, 28);
    doc.line(20, 32, 190, 32);

    doc.setFontSize(11);
    doc.text(`Employee Name  : ${payslip.employeeName}`, 20, 42);
    doc.text(`Base Pay Rate  : Rs. ${formatPrice(payslip.salaryRate)}`, 20, 48);
    doc.text(`Payment Date   : ${payslip.dateStr}`, 20, 54);
    doc.text(`Remarks / Notes : ${payslip.remarks || 'N/A'}`, 20, 60);

    doc.line(20, 65, 190, 65);
    doc.text('SALARY COMPUTATION BREAKDOWN', 20, 72);
    doc.line(20, 75, 190, 75);

    doc.text(`Base Payout Amount :`, 20, 83);
    doc.text(`Rs. ${formatPrice(payslip.amount)}`, 150, 83, { align: 'right' });

    doc.text(`Bonus Earned       :`, 20, 91);
    doc.text(`(+) Rs. ${formatPrice(payslip.bonus)}`, 150, 91, { align: 'right' });

    doc.text(`Salary Deduction   :`, 20, 99);
    doc.text(`(-) Rs. ${formatPrice(payslip.deduction)}`, 150, 99, { align: 'right' });

    doc.text(`Advance Taken      :`, 20, 107);
    doc.text(`(-) Rs. ${formatPrice(payslip.advance)}`, 150, 107, { align: 'right' });

    doc.line(20, 113, 190, 113);
    doc.setFont('helvetica', 'bold');
    doc.text(`NET DISBURSED PAY :`, 20, 120);
    doc.text(`Rs. ${formatPrice(payslip.netPay)}`, 150, 120, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.line(20, 125, 190, 125);
    doc.text('Authorized Signature: _______________________', 20, 140);
    doc.text('Employee Signature : _______________________', 20, 148);

    doc.save(`Payslip_${payslip.employeeName.replace(/\s+/g, '_')}.pdf`);
  };

  const handlePrintPayslip = () => {
    window.print();
  };

  return (
    <div className="main-content">
      {/* Tab Navigation header */}
      <div className="tab-headers">
        {isAdminOrOwner && (
          <>
            <button 
              className={`tab-header ${officeTab === 0 ? 'active' : ''}`}
              onClick={() => setOfficeTab(0)}
            >
              Daily Expenses
            </button>
            <button 
              className={`tab-header ${officeTab === 1 ? 'active' : ''}`}
              onClick={() => setOfficeTab(1)}
            >
              Employee Roster
            </button>
            <button 
              className={`tab-header ${officeTab === 2 ? 'active' : ''}`}
              onClick={() => setOfficeTab(2)}
            >
              Salaries Ledger
            </button>
          </>
        )}
        
        <button 
          className={`tab-header ${officeTab === 3 ? 'active' : ''}`}
          onClick={() => setOfficeTab(3)}
        >
          Supplier Master
        </button>

        {isAdminOrOwner && (
          <button 
            className={`tab-header ${officeTab === 4 ? 'active' : ''}`}
            onClick={() => setOfficeTab(4)}
          >
            User Accounts
          </button>
        )}
      </div>

      {officeTab === 0 && isAdminOrOwner && (
        /* EXPENSES SUB-SCREEN */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="flex-between">
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>Operating Expenses Ledger</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Track daily cash outlays such as Rent, Utilities, Fuel, and Salaries.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setIsExpenseModalOpen(true)}>
              <Plus size={18} /> Add Expense Log
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th onClick={() => requestSortExp('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Date {renderSortIcon('date', sortConfigExp)}
                  </th>
                  <th onClick={() => requestSortExp('category')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Category {renderSortIcon('category', sortConfigExp)}
                  </th>
                  <th onClick={() => requestSortExp('description')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Description {renderSortIcon('description', sortConfigExp)}
                  </th>
                  <th onClick={() => requestSortExp('billImagePath')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Bill Attachment {renderSortIcon('billImagePath', sortConfigExp)}
                  </th>
                  <th onClick={() => requestSortExp('amount')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Amount {renderSortIcon('amount', sortConfigExp)}
                  </th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No expenses registered. Log an expense to visualize net profit trends on your dashboard.
                    </td>
                  </tr>
                ) : (
                  sortedExpenses.map(exp => (
                    <tr key={exp.id}>
                      <td>
                        <div className="flex-gap" style={{ fontSize: '0.9rem' }}>
                          <Calendar size={14} style={{ color: 'var(--text-tertiary)' }} />
                          {new Date(exp.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${exp.category === 'Salary' ? 'badge-info' : 'badge-warning'}`}>
                          {exp.category}
                        </span>
                      </td>
                      <td>{exp.description || <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>General Expense</span>}</td>
                      <td>
                        {exp.billImagePath ? (
                          <button 
                            className="btn btn-secondary btn-gap" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => setViewingReceipt(exp.billImagePath || null)}
                          >
                            <Image size={12} /> View Bill
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>None</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--danger)' }}>
                        Rs. {formatPrice(exp.amount)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn btn-icon" 
                          style={{ color: 'var(--danger)' }}
                          onClick={() => handleDeleteExpense(exp.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {officeTab === 1 && isAdminOrOwner && (
        /* EMPLOYEES SUB-SCREEN */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="flex-between">
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>Store Employees</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Manage team profiles and monthly salary contract rates.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setIsEmployeeModalOpen(true)}>
              <UserPlus size={18} /> Add Employee
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th onClick={() => requestSortEmp('id')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Employee ID {renderSortIcon('id', sortConfigEmp)}
                  </th>
                  <th onClick={() => requestSortEmp('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Full Name {renderSortIcon('name', sortConfigEmp)}
                  </th>
                  <th onClick={() => requestSortEmp('salaryRate')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Contract Salary (Rs.) {renderSortIcon('salaryRate', sortConfigEmp)}
                  </th>
                  <th onClick={() => requestSortEmp('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Roster Status {renderSortIcon('status', sortConfigEmp)}
                  </th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No employee profiles found. Register your sales staff or warehouse helper.
                    </td>
                  </tr>
                ) : (
                  sortedEmployees.map(emp => (
                    <tr key={emp.id}>
                      <td>#{emp.id}</td>
                      <td style={{ fontWeight: 600 }}>{emp.name}</td>
                      <td>Rs. {formatPrice(emp.salaryRate)}/mo</td>
                      <td>
                        <span className={`badge ${emp.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                          {emp.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn btn-icon" 
                          style={{ color: 'var(--danger)' }}
                          onClick={() => handleDeleteEmployee(emp.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {officeTab === 2 && isAdminOrOwner && (
        /* SALARIES SUB-SCREEN */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="flex-between">
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>Salaries Ledger & Disbursals</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Disburse salary payments, factor bonuses/deductions, and output formal payslip PDFs.
              </p>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={() => setIsSalaryModalOpen(true)}
              disabled={employees.length === 0}
            >
              <DollarSign size={18} /> Disburse Salary
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th onClick={() => requestSortSal('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Disbursal Date {renderSortIcon('date', sortConfigSal)}
                  </th>
                  <th onClick={() => requestSortSal('employeeName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Employee Name {renderSortIcon('employeeName', sortConfigSal)}
                  </th>
                  <th onClick={() => requestSortSal('amount')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Contract Rate {renderSortIcon('amount', sortConfigSal)}
                  </th>
                  <th>Bonus / Ded. / Adv.</th>
                  <th onClick={() => requestSortSal('netPay')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Disbursed Net Pay {renderSortIcon('netPay', sortConfigSal)}
                  </th>
                  <th onClick={() => requestSortSal('remarks')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Remarks {renderSortIcon('remarks', sortConfigSal)}
                  </th>
                  <th style={{ textAlign: 'right' }}>Payslip</th>
                </tr>
              </thead>
              <tbody>
                {sortedSalaries.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No salary disbursements logged yet.
                    </td>
                  </tr>
                ) : (
                  sortedSalaries.map(sal => {
                    return (
                      <tr key={sal.id}>
                        <td>
                          <div className="flex-gap" style={{ fontSize: '0.9rem' }}>
                            <Calendar size={14} style={{ color: 'var(--text-tertiary)' }} />
                            {new Date(sal.date).toLocaleDateString()}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{sal.employeeName}</td>
                        <td>Rs. {formatPrice(sal.amount)}</td>
                        <td>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span>Bonus: +Rs.{formatPrice(sal.bonus)}</span><br/>
                            <span>Ded: -Rs.{formatPrice(sal.deduction)}</span><br/>
                            <span>Adv: -Rs.{formatPrice(sal.advance)}</span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--danger)' }}>
                          Rs. {formatPrice(sal.netPay)}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{sal.remarks}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                            onClick={() => setPrintablePayslip({
                              employeeName: sal.employeeName,
                              salaryRate: sal.amount, // base contract rate
                              amount: sal.amount,
                              bonus: sal.bonus,
                              deduction: sal.deduction,
                              advance: sal.advance,
                              netPay: sal.netPay,
                              dateStr: new Date(sal.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                              remarks: sal.remarks,
                            })}
                          >
                            <FileText size={14} /> Payslip
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {officeTab === 3 && (
        /* SUPPLIER MASTER SUB-SCREEN */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="flex-between">
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>Supplier Master Directory</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Centrally manage supplier accounts, contact networks, and addresses.
              </p>
            </div>
            {isAdminOrOwner && (
              <button className="btn btn-primary" onClick={() => setIsSupplierModalOpen(true)}>
                <UserPlus size={18} /> Add Supplier Profile
              </button>
            )}
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th onClick={() => requestSortSup('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Supplier Name {renderSortIcon('name', sortConfigSup)}
                  </th>
                  <th onClick={() => requestSortSup('firstContactName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Contact Persons {renderSortIcon('firstContactName', sortConfigSup)}
                  </th>
                  <th onClick={() => requestSortSup('firstContactPhone')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Contact Numbers {renderSortIcon('firstContactPhone', sortConfigSup)}
                  </th>
                  <th onClick={() => requestSortSup('address')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Business Address {renderSortIcon('address', sortConfigSup)}
                  </th>
                  {isAdminOrOwner && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {sortedSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={isAdminOrOwner ? 5 : 4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No suppliers registered centrally in Supplier Master.
                    </td>
                  </tr>
                ) : (
                  sortedSuppliers.map(sup => (
                    <tr key={sup.id}>
                      <td style={{ fontWeight: 600 }}>{sup.name}</td>
                      <td>
                        {sup.contacts && sup.contacts.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {sup.contacts.map((c, i) => (
                              <span key={i} className="badge badge-info" style={{ fontSize: '0.75rem', alignSelf: 'flex-start' }}>{c.name}</span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>None</span>
                        )}
                      </td>
                      <td>
                        {sup.contacts && sup.contacts.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {sup.contacts.map((c, i) => (
                              <span key={i} style={{ display: 'block' }}>{c.phone}</span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>None</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{sup.address || <span style={{ color: 'var(--text-tertiary)' }}>No Address</span>}</td>
                      {isAdminOrOwner && (
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn btn-icon" 
                            style={{ color: 'var(--danger)' }}
                            onClick={() => handleDeleteSupplier(sup.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {officeTab === 4 && isAdminOrOwner && (
        /* USER ACCOUNTS MASTER SUB-SCREEN */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="flex-between">
            <div>
              <h2 style={{ fontSize: '1.25rem' }}>Application User Accounts</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Manage login accounts, authorization access levels, and reset security credentials.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setIsUserModalOpen(true)}>
              <UserPlus size={18} /> Create New Account
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th onClick={() => requestSortUser('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Name {renderSortIcon('name', sortConfigUser)}
                  </th>
                  <th onClick={() => requestSortUser('email')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Email ID {renderSortIcon('email', sortConfigUser)}
                  </th>
                  <th onClick={() => requestSortUser('role')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    System Role {renderSortIcon('role', sortConfigUser)}
                  </th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map(u => {
                  const isActive = localStorage.getItem('current_user_email')?.toLowerCase() === u.email.toLowerCase();
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.name} {isActive && <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 500 }}>(You)</span>}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge ${u.role === 'OWNER' ? 'badge-info' : u.role === 'ADMIN' ? 'badge-success' : 'badge-warning'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-success">Active</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-secondary flex-gap"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => {
                              setResetPasswordEmail(u.email);
                              setNewPasswordVal('');
                              setIsResetPasswordModalOpen(true);
                            }}
                          >
                            <Key size={12} /> Reset Password
                          </button>
                          <button 
                            className="btn btn-icon" 
                            style={{ color: 'var(--danger)' }}
                            onClick={() => handleDeleteUser(u.email)}
                            disabled={u.role === 'OWNER' || isActive}
                            title={u.role === 'OWNER' ? 'Owner account cannot be deleted' : isActive ? 'Cannot delete currently logged in account' : 'Delete user account'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Record Expense */}
      {isExpenseModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h3>Add Expense Log</h3>
              <button className="btn btn-icon" onClick={() => setIsExpenseModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddExpense}>
              <div className="form-group">
                <label>Expense Category *</label>
                <select
                  className="input-control"
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                >
                  <option value="Misc">Misc / Miscellaneous</option>
                  <option value="Rent">Rent</option>
                  <option value="Utility">Utility Bills</option>
                  <option value="Fuel">Fuel & Transport</option>
                  <option value="Internet">Internet / Phone</option>
                </select>
              </div>

              <div className="form-group">
                <label>Amount (Rs.) *</label>
                <input
                  type="number"
                  step="any"
                  className="input-control"
                  placeholder="Enter amount paid"
                  value={expAmount || ''}
                  onChange={(e) => setExpAmount(Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  className="input-control"
                  rows={3}
                  style={{ resize: 'none' }}
                  placeholder="e.g. Paid electricity bill for May"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Attach Bill Receipt (Optional Image)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="input-control"
                  onChange={handleImageUpload}
                />
                {expImage && (
                  <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                    <img 
                      src={expImage} 
                      alt="Uploaded preview" 
                      style={{ maxHeight: '100px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}
                    />
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                Save Expense Log
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Employee */}
      {isEmployeeModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h3>Add Employee Profile</h3>
              <button className="btn btn-icon" onClick={() => setIsEmployeeModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddEmployee}>
              <div className="form-group">
                <label>Employee Full Name *</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. Ali Raza"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Monthly Salary Contract Rate (Rs.) *</label>
                <input
                  type="number"
                  step="any"
                  className="input-control"
                  placeholder="e.g. 25000"
                  value={empRate || ''}
                  onChange={(e) => setEmpRate(Number(e.target.value))}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>
                Register Employee
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Pay Salary */}
      {isSalaryModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h3>Disburse Salary Payment</h3>
              <button className="btn btn-icon" onClick={() => setIsSalaryModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePaySalary}>
              <div className="form-group">
                <label>Select Employee *</label>
                <select
                  className="input-control"
                  value={salEmployeeId}
                  onChange={(e) => handleSelectEmployeeForSalary(Number(e.target.value) || '')}
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.filter(emp => emp.status === 'Active').map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} (Rate: Rs.{formatPrice(emp.salaryRate)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Base Salary Amount (Rs.) *</label>
                <input
                  type="number"
                  step="any"
                  className="input-control"
                  value={salAmount || ''}
                  onChange={(e) => setSalAmount(Number(e.target.value))}
                  required
                />
              </div>

              <div className="grid-cols-3">
                <div className="form-group">
                  <label>Bonus (Rs.)</label>
                  <input
                    type="number"
                    step="any"
                    className="input-control"
                    placeholder="Bonus"
                    value={salBonus || ''}
                    onChange={(e) => setSalBonus(Number(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <label>Deductions (Rs.)</label>
                  <input
                    type="number"
                    step="any"
                    className="input-control"
                    placeholder="Deduction"
                    value={salDeduction || ''}
                    onChange={(e) => setSalDeduction(Number(e.target.value))}
                  />
                </div>

                <div className="form-group">
                  <label>Advance (Rs.)</label>
                  <input
                    type="number"
                    step="any"
                    className="input-control"
                    placeholder="Advance"
                    value={salAdvance || ''}
                    onChange={(e) => setSalAdvance(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Remarks</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. Salary for May 2026"
                  value={salRemarks}
                  onChange={(e) => setSalRemarks(e.target.value)}
                />
              </div>

              <div 
                style={{
                  padding: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius-md)',
                  backgroundColor: 'var(--bg-tertiary)',
                  fontSize: '0.85rem',
                  marginBottom: '1.5rem'
                }}
              >
                <div className="flex-between" style={{ fontWeight: 600 }}>
                  <span>Net Disbursable Amount:</span>
                  <span style={{ color: 'var(--primary)' }}>
                    Rs. {formatPrice(salAmount + (salBonus || 0) - (salDeduction || 0) - (salAdvance || 0))}
                  </span>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Process Salary Disbursal
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add/Edit Supplier Profile */}
      {isSupplierModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h3>Add Supplier Profile</h3>
              <button className="btn btn-icon" onClick={() => setIsSupplierModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSupplier}>
              <div className="form-group">
                <label>Supplier / Company Name *</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. Unilever Distributors"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Business Address</label>
                <textarea
                  className="input-control"
                  rows={2}
                  style={{ resize: 'none' }}
                  placeholder="Enter business address (only entered once per supplier)"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                />
              </div>

              {/* Coupled Contact Persons & Mobile Numbers */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: 600 }}>Contact Representatives & Numbers</label>
                  <button 
                    type="button" 
                    className="btn btn-secondary flex-gap"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} 
                    onClick={handleAddContactRow}
                  >
                    <PlusCircle size={12} /> Add Contact Row
                  </button>
                </div>
                
                {supContacts.map((contact, idx) => (
                  <div key={idx} style={{ 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--border-radius-sm)', 
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    backgroundColor: 'var(--bg-secondary)',
                    position: 'relative'
                  }}>
                    {supContacts.length > 1 && (
                      <button 
                        type="button" 
                        className="btn btn-icon" 
                        style={{ color: 'var(--danger)', position: 'absolute', right: '4px', top: '4px', padding: '0.15rem' }} 
                        onClick={() => handleRemoveContactRow(idx)}
                      >
                        <MinusCircle size={14} />
                      </button>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.15rem', display: 'block' }}>Person Name</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="e.g. Ali Raza"
                          value={contact.name}
                          onChange={(e) => handleContactRowChange(idx, 'name', e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.15rem', display: 'block' }}>Contact Phone</label>
                        <input
                          type="text"
                          className="input-control"
                          placeholder="e.g. 03001234567"
                          value={contact.phone}
                          onChange={(e) => handleContactRowChange(idx, 'phone', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                Save Supplier to Master
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create New User Account */}
      {isUserModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h3>Create User Account</h3>
              <button className="btn btn-icon" onClick={() => setIsUserModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  className="input-control"
                  placeholder="e.g. Usman Malik"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email Address / User ID *</label>
                <input
                  type="email"
                  className="input-control"
                  placeholder="usman@store.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Default Password *</label>
                <input
                  type="password"
                  className="input-control"
                  placeholder="Set default password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Access Level Authorization *</label>
                <select
                  className="input-control"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'ADMIN' | 'EMPLOYEE')}
                >
                  <option value="EMPLOYEE">Employee (Limited / View-Only Suppliers)</option>
                  <option value="ADMIN">Admin (Full Operational Control)</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>
                <UserCheck size={18} /> Initialize Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reset Password */}
      {isResetPasswordModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h3>Reset Account Password</h3>
              <button className="btn btn-icon" onClick={() => setIsResetPasswordModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>User Account</label>
                <input
                  type="text"
                  className="input-control"
                  value={resetPasswordEmail}
                  disabled
                  style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group">
                <label>New Password *</label>
                <input
                  type="password"
                  className="input-control"
                  placeholder="Enter new account password"
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>
                Save New Password
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: View Receipt Image */}
      {viewingReceipt && (
        <div className="modal-overlay" onClick={() => setViewingReceipt(null)}>
          <div className="modal-content" style={{ maxWidth: '600px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3>Receipt Image Preview</h3>
              <button className="btn btn-icon" onClick={() => setViewingReceipt(null)}>
                <X size={20} />
              </button>
            </div>
            <img 
              src={viewingReceipt} 
              alt="Receipt Attachment" 
              style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}
            />
          </div>
        </div>
      )}

      {/* MODAL: Payslip printable sheet popup */}
      {printablePayslip && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <h3>Salary Payslip Disbursed</h3>
              <button className="btn btn-icon" onClick={() => setPrintablePayslip(null)}>
                <X size={20} />
              </button>
            </div>

            <div 
              id="payslip-print-content"
              style={{
                padding: '1.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: 'var(--border-radius-sm)',
                backgroundColor: '#f8fafc',
                fontSize: '0.8rem',
                color: '#1e293b',
                lineHeight: 1.5,
              }}
            >
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', marginBottom: '4px' }}>
                DUKANDAR STORE MANAGER
              </div>
              <div style={{ textAlign: 'center', marginBottom: '15px', color: '#64748b' }}>
                Employee Payout Slip
              </div>
              <div style={{ borderBottom: '1px solid #e2e8f0', margin: '10px 0' }}></div>
              <div><strong>Employee Name:</strong> {printablePayslip.employeeName}</div>
              <div><strong>Contract Rate :</strong> Rs. {formatPrice(printablePayslip.salaryRate)}/mo</div>
              <div><strong>Payment Date  :</strong> {printablePayslip.dateStr}</div>
              {printablePayslip.remarks && <div><strong>Remarks       :</strong> {printablePayslip.remarks}</div>}
              
              <div style={{ borderBottom: '1px solid #e2e8f0', margin: '10px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Base Disbursed:</span>
                <span>Rs. {formatPrice(printablePayslip.amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: 'green' }}>
                <span>(+) Bonus:</span>
                <span>Rs. {formatPrice(printablePayslip.bonus)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: 'red' }}>
                <span>(-) Deductions:</span>
                <span>Rs. {formatPrice(printablePayslip.deduction)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: 'red' }}>
                <span>(-) Advance:</span>
                <span>Rs. {formatPrice(printablePayslip.advance)}</span>
              </div>
              <div style={{ borderBottom: '1px solid #cbd5e1', margin: '10px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.9rem' }}>
                <span>NET PAYMENT DISBURSED:</span>
                <span>Rs. {formatPrice(printablePayslip.netPay)}</span>
              </div>
            </div>

            <div className="grid-cols-2" style={{ marginTop: '1.5rem', gap: '0.75rem' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => handleDownloadPayslipPDF(printablePayslip)}
              >
                Download PDF
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handlePrintPayslip}
              >
                <Printer size={16} /> Print Payslip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden printing layout for Browser Print */}
      {printablePayslip && (
        <div className="print-receipt printable-area" style={{ fontFamily: 'sans-serif', fontSize: '14px', width: '100%', maxWidth: 'none', padding: '40px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>DUKANDAR RETAIL INC.</h2>
            <p style={{ margin: '4px 0', color: '#666' }}>Salary Disbursal Receipt</p>
          </div>
          <hr/>
          <p><strong>Employee:</strong> {printablePayslip.employeeName}</p>
          <p><strong>Date:</strong> {printablePayslip.dateStr}</p>
          <p><strong>Contract Base Rate:</strong> Rs. {formatPrice(printablePayslip.salaryRate)}</p>
          <p><strong>Disbursal Remarks:</strong> {printablePayslip.remarks || 'None'}</p>
          <hr/>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', margin: '20px 0' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc' }}>
                <th style={{ padding: '8px 0' }}>Line Item Description</th>
                <th style={{ padding: '8px 0', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '8px 0' }}>Disbursed Base Pay</td>
                <td style={{ padding: '8px 0', textAlign: 'right' }}>Rs. {formatPrice(printablePayslip.amount)}</td>
              </tr>
              <tr style={{ color: 'green' }}>
                <td style={{ padding: '8px 0' }}>Disbursed Bonus</td>
                <td style={{ padding: '8px 0', textAlign: 'right' }}>(+) Rs. {formatPrice(printablePayslip.bonus)}</td>
              </tr>
              <tr style={{ color: 'red' }}>
                <td style={{ padding: '8px 0' }}>Deductions Applied</td>
                <td style={{ padding: '8px 0', textAlign: 'right' }}>(-) Rs. {formatPrice(printablePayslip.deduction)}</td>
              </tr>
              <tr style={{ color: 'red' }}>
                <td style={{ padding: '8px 0' }}>Advance Adjustments</td>
                <td style={{ padding: '8px 0', textAlign: 'right' }}>(-) Rs. {formatPrice(printablePayslip.advance)}</td>
              </tr>
              <tr style={{ borderTop: '2px solid #333', fontWeight: 'bold' }}>
                <td style={{ padding: '12px 0' }}>NET DISBURSED SALARY</td>
                <td style={{ padding: '12px 0', textAlign: 'right' }}>Rs. {formatPrice(printablePayslip.netPay)}</td>
              </tr>
            </tbody>
          </table>
          <hr style={{ marginTop: '40px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px' }}>
            <span>Owner Signature: __________________</span>
            <span>Receiver Signature: __________________</span>
          </div>
        </div>
      )}
    </div>
  );
}
