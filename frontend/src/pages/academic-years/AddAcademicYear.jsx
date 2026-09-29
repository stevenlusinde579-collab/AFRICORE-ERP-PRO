import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function AddAcademicYear(){

  const navigate = useNavigate();


  const [loading,setLoading] = useState(false);

  const [message,setMessage] = useState("");



  const [form,setForm] = useState({

    year_name:"",
    term:"",
    start_date:"",
    end_date:"",
    is_active:true

  });





  const handleChange=(e)=>{


    const {name,value,type,checked}=e.target;


    setForm({

      ...form,

      [name]:

      type === "checkbox"

      ? checked

      : value

    });


  };







  const saveAcademicYear = async(e)=>{


    e.preventDefault();


    setLoading(true);

    setMessage("");




    const {data,error}=await supabase

      .from("academic_years")

      .insert([form])

      .select();





    if(error){


      console.log("SAVE ERROR:",error);


      setMessage(
        "ERROR: " + error.message
      );


      setLoading(false);

      return;


    }






    setMessage(
      "Academic Year saved successfully ✅"
    );



    setTimeout(()=>{

      navigate("/academic-years");

    },1500);




    setLoading(false);



  };








return (

<div>


<h1 className="text-3xl font-bold">

Add Academic Year

</h1>



<form

onSubmit={saveAcademicYear}

className="bg-white shadow rounded-xl p-6 mt-6"

>



<div className="grid grid-cols-1 md:grid-cols-2 gap-5">





<input

name="year_name"

placeholder="Example: 2026/2027"

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

required

>


<option value="">

Select Term

</option>


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






<label className="flex gap-2 mt-5 items-center">


<input

type="checkbox"

name="is_active"

checked={form.is_active}

onChange={handleChange}

/>


Active Academic Year


</label>






{

message &&

<div className="mt-5 p-3 bg-gray-100 rounded">

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

"Saving..."

:

"Save Academic Year"

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



export default AddAcademicYear;