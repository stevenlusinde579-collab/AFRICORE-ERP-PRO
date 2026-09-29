function AcademicYearSearch() {

  return (

    <div className="bg-white rounded-xl shadow p-5 mt-6">


      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">


        <input

          type="text"

          placeholder="Search Academic Year..."

          className="border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"

        />



        <select

          className="border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"

        >

          <option value="">
            Filter Status
          </option>

          <option value="Active">
            Active
          </option>

          <option value="Closed">
            Closed
          </option>


        </select>


      </div>


    </div>

  );

}


export default AcademicYearSearch;