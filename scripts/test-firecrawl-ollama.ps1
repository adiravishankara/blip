$body = @{
    url    = "https://job-boards.greenhouse.io/apptronik/jobs/5813722004?gh_jid=5813722004"
    formats = @(
        @{ type = "markdown" },
        @{
            type   = "json"
            prompt = "Extract structured information about the job posting."
            schema = @{
                type       = "object"
                required   = @("title","company","location","summary")
                properties = @{
                    title = @{
                        type = "string"
                    }
                    company = @{
                        type = "string"
                    }
                    location = @{
                        type = "string"
                    }
                    summary = @{
                        type = "string"
                        description = "1-2 sentence summary of the role"
                    }
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10