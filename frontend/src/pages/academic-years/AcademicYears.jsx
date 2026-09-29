import { useNavigate } from "react-router-dom";

import AcademicYearSearch from "./AcademicYearSearch";
import AcademicYearStatistics from "./AcademicYearStatistics";
import AcademicYearTable from "./AcademicYearTable";

function AcademicYears() {

  const navigate = useNavigate();

  return (

    <div>

      <div className="flex justify-between items-center mb-6">

        <div>

          <h1 className="text-3xl font-bold text-gray-800">

            Academic Year Management

          </h1>

          <p className="text-gray-600 mt-2">

            Manage academic years for the school.

          </p>

        </div>

        <button

          onClick={() => navigate("/academic-years/add")}

          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"

        >

          + Add Academic Year

        </button>

      </div>

      <AcademicYearSearch />

      <AcademicYearStatistics />

      <AcademicYearTable />

    </div>

  );

}

export default AcademicYears;