import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { ensureDefaultClasses } from "../../utils/ensureDefaultClasses";


function EditAcademicYear(){


  const {id}=useParams();

  const navigate=useNavigate();


  const [loading,setLoading]=useState(false);

  const [message,setMessage]=useState("");
  const [yearSchoolId,setYearSchoolId]=useState(null);



  const [form,setForm]=useState({

    year_name:"",
    term:"",
    start_date:"",
    end_date:"",
    is_active:false

  });






  const fetchYear=async()=>{


    const {data,error}=await supabase

      .from("academic_years")

      .select("*")

      .eq("id",id)

      .single();




    if(error){

      console.log(error);

      return;

    }



    setYearSchoolId(data.school_id ?? null);

    setForm({

      year_name:data.year_name,

      term:data.term,

      start_date:data.start_date || "",

      end_date:data.end_date || "",

      is_active:data.is_active

    });



  };






  useEffect(()=>{

    fetchYear();

  },[]);







  const handleChange=(e)=>{


    const {name,value,type,checked}=e.target;


    setForm({

      ...form,

      [name]:

      type==="checkbox"

      ?

      checked

      :

      value


    });


  };







  const updateYear=async(e)=>{


    e.preventDefault();


    setLoading(true);




    const {error}=await supabase

      .from("academic_years")

      .update(form)

      .eq("id",id);





    if(error){

      setMessage(
        "ERROR: "+error.message
      );

      setLoading(false);

      return;

    }




    if (form.is_active) {
      try {
        if (!yearSchoolId) {
          throw new Error("This academic year is not linked to a school.");
        }

        const setup = await ensureDefaultClasses(yearSchoolId, Number(id));
        setMessage(
          `Academic Year updated successfully. ${setup.created} missing default classes added. ✅`
        );
      } catch (setupError) {
        console.error("DEFAULT CLASS SETUP ERROR:", setupError);
        setMessage(
          "Academic Year was updated, but default classes could not be ensured: " +
          (setupError?.message || "Unknown error")
        );
        setLoading(false);
        return;
      }
    } else {
      setMessage("Academic Year updated successfully ✅");
    }



    setTimeout(()=>{

      navigate("/academic-years");

    },1000);



  };







return (


<div>


<h1 className="text-3xl font-bold">

Edit Academic Year

</h1>





<form

onSubmit={updateYear}

className="bg-white shadow rounded-xl p-6 mt-6"

>



<div className="grid grid-cols-1 md:grid-cols-2 gap-5">



<input

name="year_name"

value={form.year_name}

onChange={handleChange}

className="border p-3 rounded-lg"

required

/>






<select

name="term"

value={form.term}

onChange={handleChange}

className="border p-3 rounded-lg"

>


<option value="Term I">

Term I

</option>


<option value="Term II">

Term II

</option>


<option value="Term III">

Term III

</option>



</select>






<input

type="date"

name="start_date"

value={form.start_date}

onChange={handleChange}

className="border p-3 rounded-lg"

/>






<input

type="date"

name="end_date"

value={form.end_date}

onChange={handleChange}

className="border p-3 rounded-lg"

/>



</div>







<label className="flex gap-2 mt-5">


<input

type="checkbox"

name="is_active"

checked={form.is_active}

onChange={handleChange}

/>


Active Year


</label>








{

message &&

<div className="mt-5 bg-gray-100 p-3 rounded">

{message}

</div>

}








<div className="flex gap-4 mt-6">



<button

type="submit"

disabled={loading}

className="bg-blue-600 text-white px-6 py-3 rounded-lg"

>


{

loading

?

"Updating..."

:

"Update Academic Year"

}


</button>







<button

type="button"

onClick={()=>navigate("/academic-years")}

className="bg-gray-500 text-white px-6 py-3 rounded-lg"

>


Back


</button>





</div>






</form>


</div>


);


}


export default EditAcademicYear;