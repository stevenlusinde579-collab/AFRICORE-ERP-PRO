import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  MdPeople,
  MdSchool,
  MdClass,
  MdAccountBalance,
  MdAssignment,
  MdPsychology,
  MdAdd,
  MdUpload
} from "react-icons/md";

import { supabase } from "../../services/supabase";
import StudentAnalytics from "./StudentAnalytics";


function Dashboard(){

  const navigate = useNavigate();


  const [stats,setStats] = useState({
    students:0,
    teachers:0,
    classes:0
  });


  const [recentStudents,setRecentStudents] = useState([]);



  const loadDashboardData = async()=>{


    try{


      const {count:studentCount,error:studentError} = await supabase
        .from("students")
        .select("*",{count:"exact",head:true});


      if(studentError){
        console.log(studentError);
      }



      const {count:teacherCount,error:teacherError} = await supabase
        .from("teachers")
        .select("*",{count:"exact",head:true});


      if(teacherError){
        console.log(teacherError);
      }



      const {count:classCount,error:classError} = await supabase
        .from("classes")
        .select("*",{count:"exact",head:true});


      if(classError){
        console.log(classError);
      }



      setStats({

        students:studentCount || 0,

        teachers:teacherCount || 0,

        classes:classCount || 0

      });





      const {data:recent,error:recentError} = await supabase
        .from("students")
        .select(
          "first_name,last_name,admission_number,created_at"
        )
        .order("created_at",{ascending:false})
        .limit(5);



      if(recentError){

        console.log(recentError);

      }
      else{

        setRecentStudents(recent || []);

      }



    }
    catch(error){

      console.log(
        "Dashboard Error:",
        error
      );

    }


  };





  useEffect(()=>{

    loadDashboardData();

  },[]);







  const cards=[

    {
      title:"Total Students",
      value:stats.students,
      icon:<MdPeople/>,
      color:"bg-blue-600"
    },


    {
      title:"Total Teachers",
      value:stats.teachers,
      icon:<MdSchool/>,
      color:"bg-green-600"
    },


    {
      title:"Total Classes",
      value:stats.classes,
      icon:<MdClass/>,
      color:"bg-purple-600"
    },


    {
      title:"School Balance",
      value:"TZS 0",
      icon:<MdAccountBalance/>,
      color:"bg-orange-600"
    },


    {
      title:"Pending Results",
      value:"0",
      icon:<MdAssignment/>,
      color:"bg-red-600"
    },


    {
      title:"AI Analysis",
      value:"Ready",
      icon:<MdPsychology/>,
      color:"bg-indigo-600"
    }

  ];





  return(

    <div>


      <div className="mb-8">

        <h1 className="text-3xl font-bold text-gray-800">
          AfriCore ERP PRO Dashboard
        </h1>


        <p className="text-gray-600 mt-2">
          Welcome back, Admin. Here's your school overview.
        </p>


      </div>





      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">


        {
          cards.map((card,index)=>(


            <div

            key={index}

            className="bg-white rounded-xl shadow p-6 flex items-center justify-between"

            >


              <div>

                <p className="text-gray-500">
                  {card.title}
                </p>


                <h2 className="text-3xl font-bold mt-2">
                  {card.value}
                </h2>

              </div>



              <div className={`${card.color} text-white text-3xl p-4 rounded-full`}>

                {card.icon}

              </div>


            </div>


          ))

        }


      </div>






      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">



        <div className="bg-white rounded-xl shadow p-6">


          <h2 className="text-xl font-semibold mb-4">
            Quick Actions
          </h2>



          <button

          onClick={()=>navigate("/students/add")}

          className="w-full flex items-center gap-2 bg-blue-600 text-white p-3 rounded-lg mb-3"

          >

            <MdAdd/>

            Add Student

          </button>





          <button

          onClick={()=>navigate("/examination")}

          className="w-full flex items-center gap-2 bg-green-600 text-white p-3 rounded-lg"

          >

            <MdUpload/>

            Upload Exam

          </button>


        </div>






        <div className="bg-white rounded-xl shadow p-6">


          <h2 className="text-xl font-semibold">
            Recent Activities
          </h2>



          <div className="mt-4 space-y-3">


          {

          recentStudents.length===0

          ?

          <p className="text-gray-500">
            No recent activities.
          </p>


          :

          recentStudents.map((student)=>(


            <div

            key={student.admission_number}

            className="border-b pb-3"

            >

              <p className="font-semibold">
                New student registered
              </p>


              <p>
                {student.first_name} {student.last_name}
              </p>


              <p className="text-sm text-gray-400">
                Admission No: {student.admission_number}
              </p>


            </div>


          ))

          }


          </div>


        </div>



      </div>






      <div className="mt-8">

        <StudentAnalytics/>

      </div>





    </div>


  );

}


export default Dashboard;