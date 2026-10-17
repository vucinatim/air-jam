$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Threading;

public sealed class AirJamProcessJobs : IDisposable {
    [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
        public long ProcessTime, JobTime; public uint Flags;
        public UIntPtr MinimumWorkingSet, MaximumWorkingSet;
        public uint ActiveProcessLimit; public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)] struct Counters {
        public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes;
    }
    [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits {
        public BasicLimits Basic; public Counters IO;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }
    [StructLayout(LayoutKind.Sequential)] struct FileTime { public uint Low, High; }
    [StructLayout(LayoutKind.Sequential)] struct Accounting {
        public long UserTime, KernelTime, UserPeriod, KernelPeriod;
        public uint PageFaults, TotalProcesses, ActiveProcesses, TerminatedProcesses;
    }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int kind, ref ExtendedLimits limits, uint size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, uint processId);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetProcessTimes(IntPtr process, out FileTime created, out FileTime exited, out FileTime kernel, out FileTime user);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool member);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int kind, IntPtr buffer, uint length, IntPtr returned);
    [DllImport("kernel32.dll", EntryPoint="QueryInformationJobObject", SetLastError=true)] static extern bool QueryAccounting(IntPtr job, int kind, ref Accounting accounting, uint length, IntPtr returned);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint code);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    sealed class Scope {
        public IntPtr Job;
        public readonly List<IntPtr> Roots = new List<IntPtr>();
    }
    readonly Dictionary<string,Scope> scopes = new Dictionary<string,Scope>();
    static void Require(bool success) { if(!success) throw new Win32Exception(Marshal.GetLastWin32Error()); }
    public void Create(string token) {
        if(scopes.ContainsKey(token)) throw new InvalidOperationException("Duplicate process scope.");
        if(scopes.Count >= 64) throw new InvalidOperationException("Process scope allowance exceeded.");
        IntPtr job = CreateJobObject(IntPtr.Zero, null);
        Require(job != IntPtr.Zero);
        try {
            var limits = new ExtendedLimits();
            limits.Basic.Flags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE; no breakaway.
            Require(SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(typeof(ExtendedLimits))));
            scopes.Add(token, new Scope { Job = job });
        } catch { CloseHandle(job); throw; }
    }
    public void Register(string token, uint processId, bool root) {
        Scope scope = scopes[token];
        IntPtr process = OpenProcess(0x1 | 0x100 | 0x1000 | 0x100000, false, processId);
        Require(process != IntPtr.Zero);
        bool retained = false;
        try {
            FileTime created, exited, kernel, user;
            Require(GetProcessTimes(process, out created, out exited, out kernel, out user));
            bool member;
            Require(IsProcessInJob(process, scope.Job, out member));
            if(root && !member) Require(AssignProcessToJobObject(scope.Job, process));
            Require(IsProcessInJob(process, scope.Job, out member));
            if(!member) throw new InvalidOperationException("Process is not contained in its scope's job.");
            if(Array.IndexOf(Processes(scope.Job), processId) < 0) throw new InvalidOperationException("Process is absent from the job's process list.");
            if(root) { scope.Roots.Add(process); retained = true; }
        } finally { if(!retained) CloseHandle(process); }
    }
    static uint[] Processes(IntPtr job) {
        const int maximum = 4096;
        int size = 8 + IntPtr.Size * maximum;
        IntPtr buffer = Marshal.AllocHGlobal(size);
        try {
            Require(QueryInformationJobObject(job, 3, buffer, (uint)size, IntPtr.Zero));
            int count = Marshal.ReadInt32(buffer, 4);
            if(count < 0 || count > maximum) throw new InvalidOperationException("Job process list exceeds its allowance.");
            uint[] result = new uint[count];
            for(int index=0; index<count; index++) result[index] = checked((uint)Marshal.ReadIntPtr(buffer, 8 + index*IntPtr.Size).ToInt64());
            return result;
        } finally { Marshal.FreeHGlobal(buffer); }
    }
    public uint[] Close(string token) {
        Scope scope = scopes[token];
        Require(TerminateJobObject(scope.Job, 1));
        foreach(IntPtr root in scope.Roots) CloseHandle(root);
        scope.Roots.Clear();
        DateTime deadline = DateTime.UtcNow.AddSeconds(3);
        var accounting = new Accounting();
        do {
            Require(QueryAccounting(scope.Job, 1, ref accounting, (uint)Marshal.SizeOf(typeof(Accounting)), IntPtr.Zero));
            if(accounting.ActiveProcesses == 0) break;
            Thread.Sleep(25);
        } while(DateTime.UtcNow < deadline);
        if(accounting.ActiveProcesses == 0) {
            CloseHandle(scope.Job); scopes.Remove(token);
            return new uint[0];
        }
        uint[] members = Processes(scope.Job);
        if(members.Length == 0) throw new InvalidOperationException("Job cleanup accounting is unconfirmed.");
        return members;
    }
    public void Dispose() {
        foreach(Scope scope in scopes.Values) {
            CloseHandle(scope.Job);
            foreach(IntPtr root in scope.Roots) CloseHandle(root);
        }
        scopes.Clear();
    }
}
'@
$jobs = New-Object AirJamProcessJobs
try {
    [Console]::Out.WriteLine('{"kind":"ready"}')
    while ($null -ne ($line = [Console]::In.ReadLine())) {
        $request = $line | ConvertFrom-Json
        try {
            $receipt = $null
            switch ($request.kind) {
                'open' { $jobs.Create([string]$request.token) }
                'register' { $jobs.Register([string]$request.token, [uint32]$request.processId, [bool]$request.root) }
                'close' {
                    $members = @($jobs.Close([string]$request.token))
                    $survivors = @($members | ForEach-Object { @{processId=$_;groupId=$_} })
                    $status = if($members.Count -eq 0) {'tree_clean'} else {'tree_unconfirmed'}
                    $receipt = @{status=$status;token=$request.token;survivors=$survivors;errors=@()}
                }
                default { throw 'Unknown process scope operation.' }
            }
            $result = @{kind='result';id=$request.id}
            if($null -ne $receipt) { $result.receipt = $receipt }
            [Console]::Out.WriteLine(($result | ConvertTo-Json -Compress -Depth 8))
        } catch {
            [Console]::Out.WriteLine((@{kind='error';id=$request.id;message=$_.Exception.Message} | ConvertTo-Json -Compress))
        }
    }
} finally { $jobs.Dispose() }
