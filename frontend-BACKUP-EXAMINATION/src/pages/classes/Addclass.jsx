import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function Addclass() {


  const navigate = useNavigate();


  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");



  const [classData, setClassData] = useState({

    class_name: "",

    academic_level: "",

    short_name: "",

    school_id: null,

    academic_year_id: null

  });







  const handleChange = (e) => {


    const {
      name,
      value
    } = e.target;



    setClassData({

      ...classData,

      [name]: value

    });


  };









  const saveClass = async (e) => {


    e.preventDefault();


    setLoading(true);

    setMessage("");





    const payload = {


      class_name:
      classData.class_name.trim(),



      academic_level:
      classData.academic_level,



      short_name:
      classData.short_name.trim() || null,



      school_id:
      classData.school_id,



      academic_year_id:
      classData.academic_year_id



    };







    console.log(
      "CLASS PAYLOAD:",
      payload
    );







    const {

      data,

      error

    } = await supabase



    .from("classes")



    .insert([payload])



    .select();








    console.log(
      "CLASS RESULT:",
      data
    );




    console.log(
      "CLASS ERROR:",
      error
    );







    if(error){


      setMessage(
        error.message
      );


      setLoading(false);


      return;


    }








    setMessage(
      "Class added successfully ✅"
    );






    setTimeout(()=>{


      navigate("/classes");


    },1000);






    setLoading(false);



  };












  return (


    <div className="p-6">






      <h1 className="text-3xl font-bold text-gray-800">

        Add New Class

      </h1>





      <p className="text-gray-600 mt-2">

        Create class in AfriCore ERP PRO

      </p>









      <form

      onSubmit={saveClass}

      className="bg-white shadow rounded-xl p-6 mt-6"

      >






        <div className="grid md:grid-cols-2 gap-5">









          <div>


            <label className="block mb-2 font-medium">

              Class Name

            </label>


            <input


            type="text"


            name="class_name"


            value={classData.class_name}


            onChange={handleChange}


            placeholder="Example: Form One"


            required


            className="w-full border p-3 rounded-lg"


            />


          </div>









          <div>


            <label className="block mb-2 font-medium">

              Academic Level

            </label>




            <select


            name="academic_level"


            value={classData.academic_level}


            onChange={handleChange}


            required


            className="w-full border p-3 rounded-lg"


            >



            <option value="">

              Select Level

            </option>




            <option value="Primary">

              Primary

            </option>




            <option value="Secondary">

              Secondary

            </option>




            <option value="Advanced">

              Advanced

            </option>




            </select>



          </div>












          <div>


            <label className="block mb-2 font-medium">

              Short Name

            </label>



            <input


            type="text"


            name="short_name"


            value={classData.short_name}


            onChange={handleChange}


            placeholder="Example: F1"


            className="w-full border p-3 rounded-lg"


            />


          </div>












        </div>













        {


        message &&


        <div className="mt-5 bg-gray-100 p-3 rounded-lg">


          {message}


        </div>


        }













        <div className="flex gap-4 mt-6">





          <button


          disabled={loading}


          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"


          >



          {

          loading

          ?

          "Saving..."

          :

          "Save Class"

          }



          </button>









          <button


          type="button"


          onClick={()=>navigate("/classes")}


          className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg"


          >


          Back


          </button>








        </div>








      </form>








    </div>


  );


}





export default Addclass;