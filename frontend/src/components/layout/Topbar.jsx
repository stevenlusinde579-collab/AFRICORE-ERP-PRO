import RoleSwitcher from "../RoleSwitcher";

function Topbar() {
  return (
    <header className="h-16 bg-white shadow flex items-center justify-between px-6">

      {/* LEFT */}
      <h2 className="font-semibold text-xl">
        AfriCore ERP PRO Dashboard
      </h2>


      {/* CENTER / ROLE SWITCHER */}
      <div className="flex-1 flex justify-center px-6">
        <RoleSwitcher />
      </div>


      {/* RIGHT */}
      <div className="flex items-center gap-3">

        <span>
          Admin
        </span>

        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center">
          A
        </div>

      </div>

    </header>
  );
}

export default Topbar;