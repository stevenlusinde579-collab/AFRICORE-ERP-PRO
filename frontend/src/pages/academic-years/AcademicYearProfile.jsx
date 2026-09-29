import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function AcademicYearProfile(){

  const { id } = useParams();

  const navigate = useNavigate();

  const [year, setYear] = useState(null);

  const [loading, setLoading] = useState(true);



  const getAcademicYear = async()=>{

    const { data, error } = await supabase

    .from("academic_years")

    .select("*")

    .eq("id", id)

    .single();



    if(error){

      console.log("ACADEMIC YEAR PROFILE ERROR:", error);

    }

    else{

      setYear(data);

    }


    setLoading(false);

  };




  useEffect(()=>{

    getAcademicYear();

  },[]);





  if(loading){

    return(

      <div className="bg-white p-6 rounded-xl shadow">

        Loading academic year profile...

      </div>

    );

  }





  if(!year){

    return(

      <div className="bg-white p-6 rounded-xl shadow">

        Academic year not found.

      </div>

    );

  }






  return(

    <div>


      <div className="flex justify-between items-center mb-6">


        <div>

          <h1 className="text-3xl font-bold text-gray-800">

            Academic Year Profile

          </h1>


          <p className="text-gray-600">

            Complete academic year information

          </p>


        </div>



        <button

        onClick={()=>navigate("/academic-years")}

        className="bg-gray-600 text-white px-5 py-2 rounded-lg"

        >

          Back

        </button>


      </div>





      <div className="bg-white rounded-xl shadow p-6">


        <h2 className="text-2xl font-bold mb-6">

          {year.year_name}

        </h2>



        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-gray-700">


          <p>

            <b>Year Name:</b> {year.year_name || "-"}

          </p>



          <p>

            <b>Term:</b> {year.term || "-"}

          </p>



          <p>

            <b>Start Date:</b> {year.start_date || "-"}

          </p>



          <p>

            <b>End Date:</b> {year.end_date || "-"}

          </p>



          <p>

            <b>Status:</b> {year.status || "-"}

          </p>



        </div>


      </div>



    </div>

  );

}



export default AcademicYearProfile;