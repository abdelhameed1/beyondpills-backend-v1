module.exports = {
  routes: [
    {
      method: "POST",
      path: "/enroll",
      handler: "custom.enroll",
    },
    {
      method: "GET",
      path: "/getPendingEnrollments",
      handler: "custom.getPendingEnrollments",
    },
    {
      method: "GET",
      path: "/generateReferalCodes",
      handler: "custom.generateReferalCodes",
    },
    {
      method: "GET",
      path: "/getPatientEnrollments",
      handler: "custom.getPatientEnrollments",
    },
  ]

}