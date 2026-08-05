import React, { useState } from 'react';
import { Users, ShieldCheck, UserCog, Trash2, Edit3, Search } from 'lucide-react';

const UserTable = () => {
    // Mock user registry data aligned with your system's three-tier user framework
    const [usersList, setUsersList] = useState([
        { id: "USR-001", name: "Luigi B. Canlas", email: "luigi.admin@kalinga.org", role: "Administrator", status: "Active" },
        { id: "USR-002", name: "Maria Clara Santos", email: "mc.clara@kalinga.org", role: "Staff", status: "Active" },
        { id: "USR-003", name: "Juan Dela Cruz", email: "juan.delacruz@earist.edu.ph", role: "Scholar", status: "Active" },
        { id: "USR-004", name: "Serena Pascual", email: "serena.p@earist.edu.ph", role: "Scholar", status: "Flagged" }
    ]);

    const [searchTerm, setSearchTerm] = useState('');

    // Filter dynamic lookup logic
    const filteredUsers = usersList.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm font-sans">
            
            {/* Header Control Panel */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <Users size={20} className="text-[#7f2d3a]" />
                        User Account Registry
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Manage system credentials, access level roles, and profile tracking states.</p>
                </div>

                {/* Micro Search Input Control */}
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-3.5 text-slate-300" size={16} />
                    <input 
                        type="text"
                        placeholder="Search name, email, or role..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 text-xs rounded-xl focus:ring-2 focus:ring-[#7f2d3a]/20 focus:border-[#7f2d3a] outline-none transition-all placeholder:text-slate-300"
                    />
                </div>
            </div>

            {/* Structured Desktop Table Framework */}
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black text-[#7f2d3a] uppercase tracking-widest">
                            <th className="p-4">User ID</th>
                            <th className="p-4">Full Name</th>
                            <th className="p-4">Email Address</th>
                            <th className="p-4">Access Role</th>
                            <th className="p-4">Account Status</th>
                            <th className="p-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs text-slate-600 divide-y divide-slate-50">
                        {filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50/40 transition-colors">
                                    {/* ID Code Column */}
                                    <td className="p-4 font-mono font-bold text-[#7f2d3a]">{user.id}</td>
                                    
                                    {/* Name Column */}
                                    <td className="p-4 font-bold text-slate-800">{user.name}</td>
                                    
                                    {/* Email Column */}
                                    <td className="p-4 text-slate-500 font-sans">{user.email}</td>
                                    
                                    {/* Access Level Badge Column */}
                                    <td className="p-4">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider ${
                                            user.role === "Administrator" ? "bg-purple-50 text-purple-700" :
                                            user.role === "Staff" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                                        }`}>
                                            {user.role === "Administrator" && <UserCog size={10} />}
                                            {user.role === "Staff" && <ShieldCheck size={10} />}
                                            {user.role}
                                        </span>
                                    </td>
                                    
                                    {/* Status Badge Column */}
                                    <td className="p-4">
                                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                            user.status === "Active" ? "bg-emerald-500" : "bg-red-500 animate-pulse"
                                        }`} />
                                        <span className="font-medium text-slate-700">{user.status}</span>
                                    </td>
                                    
                                    {/* Control Options Buttons */}
                                    <td className="p-4 flex items-center justify-center gap-2">
                                        <button className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors">
                                            <Edit3 size={14} />
                                        </button>
                                        <button className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-slate-300 font-medium">
                                    No records matching the query parameters found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Summary Record Counter Block */}
            <div className="mt-4 pt-4 text-[11px] text-slate-400 font-sans flex justify-between items-center">
                <span>Showing {filteredUsers.length} of {usersList.length} registered credentials</span>
                <span className="text-slate-300 font-mono">Data Privacy Certified</span>
            </div>

        </div>
    );
};

export default UserTable;