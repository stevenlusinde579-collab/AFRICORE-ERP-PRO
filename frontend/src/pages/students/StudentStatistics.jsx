import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { supabase } from "../../services/supabase";


function StudentStatistics() {

  const [stats, setStats] = useState({

    total: 0,

    male: 0,

    female: 0,

    active: 0,

    newAdmissions: 0,

  });


  const [loading, setLoading] =
    useState(true);


  const [error, setError] =
    useState("");



  // =====================================================
  // GET CURRENT USER PROFILE
  // =====================================================

  const getCurrentProfile =
    useCallback(async () => {

      const {
        data: {
          user,
        },
        error: authError,
      } = await supabase.auth.getUser();


      if (authError) {
        throw authError;
      }


      if (!user) {

        throw new Error(
          "Your session has expired. Please login again."
        );

      }



      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(`
          id,
          school_id,
          role_id
        `)
        .eq("id", user.id)
        .single();


      if (profileError) {
        throw profileError;
      }


      if (!profile) {

        throw new Error(
          "Unable to load your profile."
        );

      }


      if (!profile.school_id) {

        throw new Error(
          "Your profile is not assigned to a school."
        );

      }


      return profile;

    }, []);



  // =====================================================
  // GET CURRENT ACTIVE ACADEMIC YEAR
  // =====================================================

  const getCurrentAcademicYear =
    useCallback(async (schoolId) => {

      const {
        data: academicYear,
        error,
      } = await supabase
        .from("academic_years")
        .select(`
          id,
          school_id,
          year_name,
          term,
          start_date,
          end_date,
          is_active
        `)
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("id", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();


      if (error) {
        throw error;
      }


      if (!academicYear) {

        throw new Error(
          "No active academic year has been configured for your school."
        );

      }


      return academicYear;

    }, []);



  // =====================================================
  // LOAD STATISTICS
  // =====================================================

  const loadStatistics =
    useCallback(async () => {

      try {

        setLoading(true);

        setError("");


        // =================================================
        // PROFILE
        // =================================================

        const profile =
          await getCurrentProfile();


        console.log(
          "STUDENT STATISTICS SCHOOL:",
          profile.school_id
        );



        // =================================================
        // ACTIVE ACADEMIC YEAR
        // =================================================

        const academicYear =
          await getCurrentAcademicYear(
            profile.school_id
          );


        console.log(
          "STUDENT STATISTICS ACADEMIC YEAR:",
          academicYear.id,
          academicYear.year_name
        );



        // =================================================
        // BASE QUERY
        // =================================================
        //
        // Every statistic below uses the SAME:
        //
        // school_id
        // academic_year_id
        //
        // This prevents old-year students from being
        // counted in the current Student Management cards.
        //
        // =================================================

        const baseQuery = () => {

          return supabase
            .from("students")
            .select("*", {
              count: "exact",
              head: true,
            })
            .eq(
              "school_id",
              profile.school_id
            )
            .eq(
              "academic_year_id",
              academicYear.id
            );

        };



        // =================================================
        // TOTAL STUDENTS
        // =================================================

        const {
          count: total,
          error: totalError,
        } = await baseQuery();


        if (totalError) {
          throw totalError;
        }



        // =================================================
        // MALE
        // =================================================

        const {
          count: male,
          error: maleError,
        } = await baseQuery()
          .eq(
            "gender",
            "Male"
          );


        if (maleError) {
          throw maleError;
        }



        // =================================================
        // FEMALE
        // =================================================

        const {
          count: female,
          error: femaleError,
        } = await baseQuery()
          .eq(
            "gender",
            "Female"
          );


        if (femaleError) {
          throw femaleError;
        }



        // =================================================
        // ACTIVE
        // =================================================

        const {
          count: active,
          error: activeError,
        } = await baseQuery()
          .eq(
            "status",
            "Active"
          )
          .eq(
            "student_status",
            "Active"
          );


        if (activeError) {
          throw activeError;
        }



        // =================================================
        // NEW ADMISSIONS THIS MONTH
        // =================================================

        const firstDay =
          new Date();


        firstDay.setDate(1);


        const firstDayString =
          firstDay
            .toISOString()
            .split("T")[0];


        const {
          count: newAdmissions,
          error: admissionError,
        } = await baseQuery()
          .gte(
            "admission_date",
            firstDayString
          );


        if (admissionError) {
          throw admissionError;
        }



        // =================================================
        // SAVE STATISTICS
        // =================================================

        setStats({

          total:
            total || 0,

          male:
            male || 0,

          female:
            female || 0,

          active:
            active || 0,

          newAdmissions:
            newAdmissions || 0,

        });


      } catch (error) {

        console.error(
          "LOAD STUDENT STATISTICS ERROR:",
          error
        );


        setError(
          error?.message ||
          "Failed to load student statistics."
        );


        setStats({

          total: 0,

          male: 0,

          female: 0,

          active: 0,

          newAdmissions: 0,

        });

      } finally {

        setLoading(false);

      }

    }, [
      getCurrentProfile,
      getCurrentAcademicYear,
    ]);



  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {

    loadStatistics();

  }, [loadStatistics]);



  // =====================================================
  // STATISTICS
  // =====================================================

  const statistics = [

    {

      title:
        "Total Students",

      value:
        stats.total,

      color:
        "bg-blue-600",

    },


    {

      title:
        "Male Students",

      value:
        stats.male,

      color:
        "bg-green-600",

    },


    {

      title:
        "Female Students",

      value:
        stats.female,

      color:
        "bg-pink-600",

    },


    {

      title:
        "Active Students",

      value:
        stats.active,

      color:
        "bg-purple-600",

    },


    {

      title:
        "New Admissions",

      value:
        stats.newAdmissions,

      color:
        "bg-orange-600",

    },

  ];



  // =====================================================
  // ERROR
  // =====================================================

  if (error) {

    return (

      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">

        <p className="font-semibold">
          Unable to load student statistics
        </p>

        <p className="mt-1 text-sm">
          {error}
        </p>

      </div>

    );

  }



  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {

    return (

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">

        {statistics.map(
          (item) => (

            <div
              key={item.title}
              className={`${item.color} text-white rounded-xl shadow-lg p-6 animate-pulse`}
            >

              <p className="text-sm opacity-80">
                {item.title}
              </p>


              <h2 className="text-3xl font-bold mt-3">
                ...
              </h2>

            </div>

          )
        )}

      </div>

    );

  }



  // =====================================================
  // RENDER
  // =====================================================

  return (

    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">

      {statistics.map(
        (item) => (

          <div
            key={item.title}
            className={`${item.color} text-white rounded-xl shadow-lg p-6`}
          >

            <p className="text-sm opacity-80">

              {item.title}

            </p>


            <h2 className="text-3xl font-bold mt-3">

              {item.value}

            </h2>

          </div>

        )
      )}

    </div>

  );

}


export default StudentStatistics;